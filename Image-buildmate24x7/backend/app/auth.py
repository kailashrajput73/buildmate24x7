from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import AuthSession, User

password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return password_hash.verify(password, hashed)
    except (ValueError, TypeError):
        return False


def create_token(user: User, db: Session) -> tuple[str, int]:
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=settings.jwt_ttl_minutes)
    token_id = uuid4()
    db.add(AuthSession(user_id=user.id, token_id=token_id, expires_at=expires_at))
    claims = {"sub": str(user.id), "jti": str(token_id), "iat": now, "exp": expires_at}
    token = jwt.encode(claims, settings.jwt_secret.get_secret_value(), algorithm="HS256")
    return token, int((expires_at - now).total_seconds())


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=["HS256"],
            options={"require": ["sub", "jti", "iat", "exp"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    bearer_token = credentials.credentials if credentials and credentials.credentials.strip() else None
    cookie_token = request.cookies.get(settings.auth_cookie_name)
    token = bearer_token or cookie_token
    if token is None:
        raise HTTPException(status_code=401, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})
    claims = decode_token(token)
    session = db.scalar(select(AuthSession).where(AuthSession.token_id == UUID(claims["jti"])))
    user = db.get(User, UUID(claims["sub"]))
    expires = datetime.fromtimestamp(claims["exp"], UTC)
    now = datetime.now(UTC)
    if (
        not session
        or session.revoked_at is not None
        or session.expires_at.replace(tzinfo=UTC) <= now
        or expires <= now
        or not user
        or not user.is_active
        or user.deleted_at is not None
    ):
        raise HTTPException(status_code=401, detail="Invalid or expired credentials", headers={"WWW-Authenticate": "Bearer"})
    if cookie_token is not None and bearer_token is None and request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin", "").rstrip("/")
        allowed_origins = {value.rstrip("/") for value in settings.cors_origins}
        request_origin = str(request.base_url).rstrip("/")
        origin_allowed = bool(origin) and (origin in allowed_origins or origin == request_origin)
        # Some reverse proxies reconstruct request.base_url without the dashboard's
        # external port/host. Browser-controlled Fetch Metadata proves the request
        # is same-origin even when the Origin header cannot match that reconstruction.
        same_origin_fetch = request.headers.get("sec-fetch-site", "").lower() == "same-origin"
        same_origin = origin_allowed or same_origin_fetch
        if not same_origin:
            raise HTTPException(status_code=403, detail="CSRF origin check failed")
    request.state.auth_session = session
    return user
