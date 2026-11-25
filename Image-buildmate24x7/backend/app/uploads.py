import hashlib
import json
import os
import tempfile
import warnings
from datetime import datetime
from pathlib import Path
from uuid import UUID, uuid4

import pillow_avif  # noqa: F401 -- registers AVIF decoding with Pillow
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Asset, AssetVersion, Folder, User

router = APIRouter(tags=["uploads"])
SUPPORTED = {"JPEG": ("jpeg", "image/jpeg"), "PNG": ("png", "image/png"), "WEBP": ("webp", "image/webp"), "AVIF": ("avif", "image/avif")}
CHUNK_SIZE = 1024 * 1024


class UploadMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_code: str | None = Field(default=None, max_length=160)
    product_name: str | None = Field(default=None, max_length=255)
    brand: str | None = Field(default=None, max_length=160)
    product_family: str | None = Field(default=None, max_length=160)
    category: str | None = Field(default=None, max_length=160)
    variant: str | None = Field(default=None, max_length=160)
    tags: list[str] = Field(default_factory=list, max_length=50)


class AssetSummary(BaseModel):
    id: UUID
    folder_id: UUID | None
    original_filename: str
    media_type: str
    format: str
    width: int
    height: int
    byte_size: int
    sha256: str
    product_code: str | None
    product_name: str | None
    brand: str | None
    product_family: str | None
    category: str | None
    variant: str | None
    tags: list[str]
    original_url: str
    created_at: datetime


class UploadItem(BaseModel):
    filename: str
    status: str
    asset: AssetSummary | None = None
    duplicate_warning: bool = False
    error: str | None = None


class UploadBatch(BaseModel):
    results: list[UploadItem]
    succeeded: int
    failed: int


def _public_url(asset: Asset) -> str:
    return f"{settings.cdn_origin}/original/{asset.id}.{asset.format}"


def _asset_summary(asset: Asset) -> AssetSummary:
    return AssetSummary(
        id=asset.id, folder_id=asset.folder_id, original_filename=asset.original_filename,
        media_type=asset.media_type, format=asset.format, width=asset.width, height=asset.height,
        byte_size=asset.byte_size, sha256=asset.sha256, product_code=asset.product_code,
        product_name=asset.product_name, brand=asset.brand, product_family=asset.product_family,
        category=asset.category, variant=asset.variant,
        tags=json.loads(asset.tags or "[]"), original_url=_public_url(asset), created_at=asset.created_at,
    )


async def _persist_upload(upload: UploadFile, folder_id: UUID | None, metadata: UploadMetadata, user: User, db: Session) -> tuple[Asset, bool]:
    root = settings.storage_root.resolve()
    temp_dir = root / "temp"
    original_dir = root / "originals"
    temp_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    original_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temp_name = tempfile.mkstemp(prefix="upload-", suffix=".part", dir=temp_dir)
    temp_path = Path(temp_name)
    byte_size = 0
    digest = hashlib.sha256()
    try:
        with os.fdopen(fd, "wb") as target:
            while chunk := await upload.read(CHUNK_SIZE):
                byte_size += len(chunk)
                if byte_size > settings.upload_max_bytes:
                    raise ValueError("File exceeds the configured upload size limit")
                digest.update(chunk)
                target.write(chunk)
            target.flush()
            os.fsync(target.fileno())
        if byte_size == 0:
            raise ValueError("File is empty")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(temp_path) as image:
                    detected = image.format
                    width, height = image.size
                    if detected not in SUPPORTED:
                        raise ValueError("Unsupported image format; use JPEG, PNG, WebP or AVIF")
                    if width < 1 or height < 1 or width * height > settings.upload_max_pixels:
                        raise ValueError("Image dimensions exceed the configured pixel limit")
                    image.verify()
                # Decode the pixels as well as verifying headers to reject truncated/corrupt payloads.
                with Image.open(temp_path) as image:
                    image.load()
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
            raise ValueError("File contents are not a valid supported image") from exc

        extension, media_type = SUPPORTED[detected]
        asset_id = uuid4()
        storage_key = f"{asset_id}.{extension}"
        final_path = original_dir / storage_key
        duplicate = db.scalar(select(Asset.id).where(Asset.sha256 == digest.hexdigest(), Asset.deleted_at.is_(None)).limit(1)) is not None
        asset = Asset(
            id=asset_id, folder_id=folder_id, original_filename=(Path(upload.filename or "image").name[:255] or "image"),
            media_type=media_type, format=extension, width=width, height=height, byte_size=byte_size,
            sha256=digest.hexdigest(), storage_key=storage_key, product_code=metadata.product_code,
            product_name=metadata.product_name, brand=metadata.brand, product_family=metadata.product_family,
            category=metadata.category, variant=metadata.variant, tags=json.dumps(metadata.tags, ensure_ascii=False),
            status="active", uploaded_by=user.id,
        )
        version = AssetVersion(
            asset_id=asset_id, version_number=1, sha256=asset.sha256, storage_key=storage_key,
            media_type=media_type, format=extension, width=width, height=height,
            byte_size=byte_size, created_by=user.id,
        )
        temp_path.replace(final_path)
        try:
            db.add_all([asset, version])
            db.commit()
            db.refresh(asset)
        except Exception:
            db.rollback()
            final_path.unlink(missing_ok=True)
            raise
        return asset, duplicate
    finally:
        temp_path.unlink(missing_ok=True)


@router.post("/api/v1/uploads", response_model=UploadBatch, status_code=status.HTTP_200_OK)
async def upload_files(
    files: list[UploadFile] = File(..., alias="files[]", min_length=1, max_length=50),
    folder_id: UUID | None = Form(default=None),
    metadata: str = Form(default="{}"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadBatch:
    try:
        metadata_value = json.loads(metadata)
        if isinstance(metadata_value, list):
            if len(metadata_value) != len(files):
                raise ValueError("Per-file metadata count must match files[]")
            parsed_metadata = [UploadMetadata.model_validate(item) for item in metadata_value]
        else:
            parsed_metadata = [UploadMetadata.model_validate(metadata_value)] * len(files)
    except (ValidationError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="Invalid upload metadata") from exc
    if folder_id is not None and db.scalar(select(Folder.id).where(Folder.id == folder_id, Folder.deleted_at.is_(None))) is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    results: list[UploadItem] = []
    for index, upload in enumerate(files):
        name = Path(upload.filename or "image").name[:255] or "image"
        try:
            asset, duplicate = await _persist_upload(upload, folder_id, parsed_metadata[index], user, db)
            results.append(UploadItem(filename=name, status="uploaded", asset=_asset_summary(asset), duplicate_warning=duplicate))
        except ValueError as exc:
            results.append(UploadItem(filename=name, status="failed", error=str(exc)))
        except Exception:
            # Keep batch success visible while avoiding storage paths or DB details in the response.
            results.append(UploadItem(filename=name, status="failed", error="Upload could not be registered"))
        finally:
            await upload.close()
    succeeded = sum(item.status == "uploaded" for item in results)
    return UploadBatch(results=results, succeeded=succeeded, failed=len(results) - succeeded)


@router.get("/original/{asset_id}.{extension}", include_in_schema=False)
def get_original(asset_id: UUID, extension: str, db: Session = Depends(get_db)) -> FileResponse:
    asset = db.scalar(select(Asset).where(Asset.id == asset_id, Asset.format == extension, Asset.status == "active", Asset.deleted_at.is_(None)))
    if asset is None:
        raise HTTPException(status_code=404, detail="Original image not found")
    path = (settings.storage_root / "originals" / asset.storage_key).resolve()
    originals = (settings.storage_root / "originals").resolve()
    if path.parent != originals or not path.is_file():
        raise HTTPException(status_code=404, detail="Original image not found")
    return FileResponse(path, media_type=asset.media_type, headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=31536000, immutable", "ETag": f'"{asset.sha256}"'})
