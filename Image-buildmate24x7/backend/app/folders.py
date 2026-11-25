import unicodedata
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Asset, Folder, User
from app.schemas import FolderCreate, FolderListResponse, FolderOut, FolderReorderRequest, FolderUpdate

router = APIRouter(prefix="/api/v1/folders", tags=["folders"], dependencies=[Depends(get_current_user)])


def _lock_folder_writes(db: Session) -> None:
    # Serialize tree writes so concurrent moves cannot create a cycle.
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(2411250201)"))


def _active_folder(db: Session, folder_id: UUID) -> Folder:
    folder = db.scalar(select(Folder).where(Folder.id == folder_id, Folder.deleted_at.is_(None)))
    if folder is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


def _clean_name(value: str) -> tuple[str, str]:
    name = unicodedata.normalize("NFKC", value).strip()
    if not name:
        raise HTTPException(status_code=422, detail="Folder name cannot be empty")
    if len(name) > 120:
        raise HTTPException(status_code=422, detail="Folder name is too long")
    if "/" in name or "\\" in name or any(unicodedata.category(char).startswith("C") for char in name):
        raise HTTPException(status_code=422, detail="Folder name contains unsupported characters")
    normalized_name = name.casefold()
    if len(normalized_name) > 320:
        raise HTTPException(status_code=422, detail="Normalized folder name is too long")
    return name, normalized_name


def _validate_parent(db: Session, parent_id: UUID | None, moving_id: UUID | None = None) -> Folder | None:
    if parent_id is None:
        return None
    parent = _active_folder(db, parent_id)
    cursor: Folder | None = parent
    visited: set[UUID] = set()
    while cursor is not None:
        if cursor.id == moving_id:
            raise HTTPException(status_code=409, detail="A folder cannot be moved into itself or one of its descendants")
        if cursor.id in visited:
            raise HTTPException(status_code=409, detail="Folder hierarchy contains a cycle")
        visited.add(cursor.id)
        cursor = db.get(Folder, cursor.parent_id) if cursor.parent_id is not None else None
        if cursor is not None and cursor.deleted_at is not None:
            raise HTTPException(status_code=409, detail="Cannot move a folder below a deleted folder")
    return parent


def _ensure_name_available(db: Session, name_key: str, parent_id: UUID | None, exclude_id: UUID | None = None) -> None:
    statement = select(Folder.id).where(Folder.normalized_name == name_key, Folder.deleted_at.is_(None))
    statement = statement.where(Folder.parent_id.is_(None) if parent_id is None else Folder.parent_id == parent_id)
    if exclude_id is not None:
        statement = statement.where(Folder.id != exclude_id)
    if db.scalar(statement.limit(1)) is not None:
        raise HTTPException(status_code=409, detail="A folder with this name already exists at that level")


def _next_order(db: Session, parent_id: UUID | None) -> int:
    statement = select(func.max(Folder.display_order)).where(Folder.deleted_at.is_(None))
    statement = statement.where(Folder.parent_id.is_(None) if parent_id is None else Folder.parent_id == parent_id)
    return int(db.scalar(statement) or 0) + 1000


def _folder_out(db: Session, folder: Folder, children_count: int | None = None, image_count: int | None = None) -> FolderOut:
    if children_count is None:
        children_count = int(
            db.scalar(select(func.count(Folder.id)).where(Folder.parent_id == folder.id, Folder.deleted_at.is_(None))) or 0
        )
    if image_count is None:
        image_count = int(db.scalar(select(func.count(Asset.id)).where(Asset.folder_id == folder.id, Asset.deleted_at.is_(None))) or 0)
    return FolderOut(
        id=folder.id,
        parent_id=folder.parent_id,
        name=folder.name,
        description=folder.description,
        display_order=folder.display_order,
        image_count=image_count,
        children_count=children_count,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
    )


def _db_conflict(db: Session) -> None:
    db.rollback()
    raise HTTPException(status_code=409, detail="Folder change conflicts with an existing folder")


@router.get("", response_model=FolderListResponse)
def list_folders(
    parent_id: UUID | None = None,
    query: str | None = Query(default=None, max_length=120),
    db: Session = Depends(get_db),
) -> FolderListResponse:
    statement = select(Folder).where(Folder.deleted_at.is_(None))
    if parent_id is not None:
        statement = statement.where(Folder.parent_id == parent_id)
    if query and query.strip():
        normalized = unicodedata.normalize("NFKC", query).strip().casefold()
        statement = statement.where(Folder.normalized_name.contains(normalized, autoescape=True))
    folders = list(
        db.scalars(
            statement.order_by(Folder.parent_id.asc().nulls_first(), Folder.display_order.asc(), Folder.id.asc())
        ).all()
    )
    child_counts = dict(
        db.execute(
            select(Folder.parent_id, func.count(Folder.id))
            .where(Folder.deleted_at.is_(None), Folder.parent_id.is_not(None))
            .group_by(Folder.parent_id)
        ).all()
    )
    image_counts = dict(
        db.execute(
            select(Asset.folder_id, func.count(Asset.id))
            .where(Asset.deleted_at.is_(None), Asset.folder_id.is_not(None))
            .group_by(Asset.folder_id)
        ).all()
    )
    return FolderListResponse(
        items=[_folder_out(db, folder, int(child_counts.get(folder.id, 0)), int(image_counts.get(folder.id, 0))) for folder in folders],
        total=len(folders),
    )


@router.post("", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
def create_folder(
    payload: FolderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FolderOut:
    _lock_folder_writes(db)
    name, normalized_name = _clean_name(payload.name)
    _validate_parent(db, payload.parent_id)
    _ensure_name_available(db, normalized_name, payload.parent_id)
    folder = Folder(
        parent_id=payload.parent_id,
        name=name,
        normalized_name=normalized_name,
        description=payload.description.strip() if payload.description else None,
        display_order=_next_order(db, payload.parent_id),
        created_by=user.id,
    )
    db.add(folder)
    try:
        db.commit()
    except IntegrityError:
        _db_conflict(db)
    db.refresh(folder)
    return _folder_out(db, folder, 0)


@router.patch("/{folder_id}", response_model=FolderOut)
def update_folder(folder_id: UUID, payload: FolderUpdate, db: Session = Depends(get_db)) -> FolderOut:
    _lock_folder_writes(db)
    folder = _active_folder(db, folder_id)
    changes = payload.model_dump(exclude_unset=True)
    parent_id = changes.get("parent_id", folder.parent_id)
    _validate_parent(db, parent_id, moving_id=folder.id)
    if "name" in changes and changes["name"] is not None:
        name, normalized_name = _clean_name(changes["name"])
    else:
        name, normalized_name = folder.name, folder.normalized_name
    if "name" in changes or "parent_id" in changes:
        _ensure_name_available(db, normalized_name, parent_id, exclude_id=folder.id)
    parent_changed = "parent_id" in changes and parent_id != folder.parent_id
    folder.name = name
    folder.normalized_name = normalized_name
    folder.parent_id = parent_id
    if parent_changed and "display_order" not in changes:
        folder.display_order = _next_order(db, parent_id)
    if "description" in changes:
        folder.description = changes["description"].strip() if changes["description"] else None
    if "display_order" in changes and changes["display_order"] is not None:
        folder.display_order = changes["display_order"]
    try:
        db.commit()
    except IntegrityError:
        _db_conflict(db)
    db.refresh(folder)
    return _folder_out(db, folder)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(folder_id: UUID, db: Session = Depends(get_db)) -> Response:
    _lock_folder_writes(db)
    folder = _active_folder(db, folder_id)
    child_exists = db.scalar(
        select(Folder.id).where(Folder.parent_id == folder.id, Folder.deleted_at.is_(None)).limit(1)
    ) is not None
    asset_exists = db.scalar(select(Asset.id).where(Asset.folder_id == folder.id, Asset.deleted_at.is_(None)).limit(1)) is not None
    if child_exists or asset_exists:
        raise HTTPException(status_code=409, detail="Folder must be empty and have no subfolders before deletion")
    folder.deleted_at = datetime.now(UTC)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_folders(payload: FolderReorderRequest, db: Session = Depends(get_db)) -> Response:
    _lock_folder_writes(db)
    item_ids = [item.id for item in payload.items]
    if len(set(item_ids)) != len(item_ids):
        raise HTTPException(status_code=422, detail="Each folder may appear only once")
    requested_orders = [item.display_order for item in payload.items]
    if len(set(requested_orders)) != len(requested_orders):
        raise HTTPException(status_code=422, detail="Folder ordering values must be unique")
    folders = list(
        db.scalars(select(Folder).where(Folder.id.in_(item_ids), Folder.deleted_at.is_(None)).with_for_update()).all()
    )
    if len(folders) != len(item_ids):
        raise HTTPException(status_code=404, detail="One or more folders were not found")
    parent_ids = {folder.parent_id for folder in folders}
    if len(parent_ids) != 1:
        raise HTTPException(status_code=409, detail="Folders must be siblings to be reordered")
    parent_id = next(iter(parent_ids))
    siblings_statement = select(Folder.id).where(Folder.deleted_at.is_(None))
    siblings_statement = siblings_statement.where(Folder.parent_id.is_(None) if parent_id is None else Folder.parent_id == parent_id)
    sibling_ids = set(db.scalars(siblings_statement).all())
    if set(item_ids) != sibling_ids:
        raise HTTPException(status_code=409, detail="Reorder must include every active sibling folder")
    order_map = {item.id: item.display_order for item in payload.items}
    for folder in folders:
        folder.display_order = order_map[folder.id]
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
