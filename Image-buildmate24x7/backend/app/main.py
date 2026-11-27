from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import select, text, update
from sqlalchemy.orm import Session

from app.auth import create_token, decode_token, get_current_user, hash_password, verify_password
from app.config import settings
from app.database import engine, get_db
from app.folders import router as folders_router
from app.exports import router as exports_router
from app.asset_actions import router as asset_actions_router
from app.limiter import limiter
from app.models import AuthSession, User
from app.uploads import router as uploads_router
from app.schemas import LoginRequest, LoginResponse, PasswordChangeRequest, UserSummary


def ensure_bootstrap_admin() -> None:
    email = str(settings.bootstrap_admin_email).strip().lower()
    with Session(engine) as db:
        admin = db.scalar(select(User).where(User.email == email))
        if admin is None:
            db.add(
                User(
                    email=email,
                    password_hash=hash_password(settings.bootstrap_admin_password.get_secret_value()),
                    display_name="Administrator",
                )
            )
            db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_bootstrap_admin()
    yield


app = FastAPI(
    title="BuildMate Image Cloud API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.enable_api_docs else None,
    openapi_url="/openapi.json" if settings.enable_api_docs else None,
    redoc_url=None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(RequestValidationError)
async def safe_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Omit submitted values so malformed login requests cannot echo passwords back to clients.
    errors = [{"loc": error["loc"], "msg": error["msg"], "type": error["type"]} for error in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errors})


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if request.url.path.startswith("/api/") or request.url.path.startswith("/health/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response
app.include_router(folders_router)
app.include_router(uploads_router)
app.include_router(exports_router)
app.include_router(asset_actions_router)


@app.get("/health/live", tags=["health"])
def health_live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def health_ready(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database is not ready") from exc
    return {"status": "ready"}


@app.post("/api/v1/auth/login", response_model=LoginResponse, tags=["authentication"])
@limiter.limit("5/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    email = str(payload.email).strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if not user or not user.is_active or user.deleted_at is not None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password", headers={"WWW-Authenticate": "Bearer"})
    prior_token=request.cookies.get(settings.auth_cookie_name)
    if prior_token:
        try:
            prior_claims=decode_token(prior_token)
            prior_session=db.scalar(select(AuthSession).where(AuthSession.token_id==UUID(prior_claims["jti"])))
            if prior_session and prior_session.revoked_at is None:
                prior_session.revoked_at=datetime.now(UTC)
        except HTTPException:
            # An expired or malformed cookie does not prevent credential-based login.
            pass
    token, expires_in = create_token(user, db)
    response = JSONResponse(content=LoginResponse(access_token=token, expires_in=expires_in, user=UserSummary.model_validate(user)).model_dump(mode="json"))
    response.set_cookie(key=settings.auth_cookie_name,value=token,max_age=expires_in,httponly=True,secure=settings.auth_cookie_secure,samesite="lax",path="/api/v1")
    user.last_login_at = datetime.now(UTC)
    db.commit()
    return response


@app.get("/api/v1/auth/me", response_model=UserSummary, tags=["authentication"])
def me(user: User = Depends(get_current_user)) -> UserSummary:
    return UserSummary.model_validate(user)


@app.post("/api/v1/auth/logout", status_code=status.HTTP_204_NO_CONTENT, tags=["authentication"])
def logout(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    session = getattr(request.state,"auth_session",None)
    if session:
        session.revoked_at = datetime.now(UTC)
        db.commit()
    response=Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(settings.auth_cookie_name,path="/api/v1",secure=settings.auth_cookie_secure,httponly=True,samesite="lax")
    return response


@app.post("/api/v1/auth/password", status_code=status.HTTP_204_NO_CONTENT, tags=["authentication"])
def change_password(
    payload: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must differ from current password")
    now = datetime.now(UTC)
    user.password_hash = hash_password(payload.new_password)
    db.execute(update(AuthSession).where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None)).values(revoked_at=now))
    db.commit()
    response=Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(settings.auth_cookie_name,path="/api/v1",secure=settings.auth_cookie_secure,httponly=True,samesite="lax")
    return response
