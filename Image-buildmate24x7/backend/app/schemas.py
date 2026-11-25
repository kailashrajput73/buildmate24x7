from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=14, max_length=1024)


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    display_name: str | None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserSummary


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    parent_id: UUID | None = None
    description: str | None = Field(default=None, max_length=2000)


class FolderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    parent_id: UUID | None = None
    description: str | None = Field(default=None, max_length=2000)
    display_order: int | None = Field(default=None, ge=0)


class FolderOut(BaseModel):
    id: UUID
    parent_id: UUID | None
    name: str
    description: str | None
    display_order: int
    image_count: int = 0
    children_count: int = 0
    created_at: datetime
    updated_at: datetime


class FolderListResponse(BaseModel):
    items: list[FolderOut]
    total: int


class FolderReorderItem(BaseModel):
    id: UUID
    display_order: int = Field(ge=0)


class FolderReorderRequest(BaseModel):
    items: list[FolderReorderItem] = Field(min_length=1, max_length=1000)
