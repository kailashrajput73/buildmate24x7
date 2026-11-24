from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
from fastapi import Depends, HTTPException, status
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
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})
    claims = decode_token(credentials.credentials)
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
    return user
