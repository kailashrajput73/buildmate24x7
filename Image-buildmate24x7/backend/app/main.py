from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import select, text, update
from sqlalchemy.orm import Session

from app.auth import bearer_scheme, create_token, decode_token, get_current_user, hash_password, verify_password
from app.config import settings
from app.database import engine, get_db
from app.folders import router as folders_router
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
app.include_router(folders_router)
app.include_router(uploads_router)


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
    token, expires_in = create_token(user, db)
    user.last_login_at = datetime.now(UTC)
    db.commit()
    return LoginResponse(access_token=token, expires_in=expires_in, user=UserSummary.model_validate(user))


@app.get("/api/v1/auth/me", response_model=UserSummary, tags=["authentication"])
def me(user: User = Depends(get_current_user)) -> UserSummary:
    return UserSummary.model_validate(user)


@app.post("/api/v1/auth/logout", status_code=status.HTTP_204_NO_CONTENT, tags=["authentication"])
def logout(
    user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Response:
    claims = decode_token(credentials.credentials)
    session = db.scalar(select(AuthSession).where(AuthSession.token_id == UUID(claims["jti"]), AuthSession.user_id == user.id))
    if session:
        session.revoked_at = datetime.now(UTC)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
    return Response(status_code=status.HTTP_204_NO_CONTENT)
