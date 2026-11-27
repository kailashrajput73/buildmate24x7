import csv
from io import BytesIO, StringIO
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from openpyxl import Workbook
from openpyxl.styles import Font
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Asset, Folder, User
from app.uploads import _asset_query, _public_url
from app.limiter import limiter

router = APIRouter(prefix="/api/v1", tags=["exports"], dependencies=[Depends(get_current_user)])
HEADERS = ["asset_id", "original_filename", "original_url", "format", "media_type", "width", "height", "byte_size", "product_code", "product_name", "brand", "product_family", "category", "variant", "tags", "folder_id", "folder_path", "uploaded_at"]

def _rows(assets, db: Session):
    folders={folder.id:folder for folder in db.scalars(select(Folder).where(Folder.deleted_at.is_(None))).all()}
    def folder_path(folder_id):
        names=[];seen=set();folder=folders.get(folder_id)
        while folder and folder.id not in seen:
            seen.add(folder.id);names.append(folder.name);folder=folders.get(folder.parent_id)
        return "/".join(reversed(names))
    return [[str(a.id), a.original_filename, _public_url(a), a.format, a.media_type, a.width, a.height, a.byte_size,
             a.product_code or "", a.product_name or "", a.brand or "", a.product_family or "", a.category or "", a.variant or "",
             a.tags or "[]", str(a.folder_id or ""), folder_path(a.folder_id), a.created_at.isoformat() if a.created_at else ""] for a in assets]

def _assets(db: Session, asset_ids: list[UUID] | None, folder_id: UUID | None, include_subfolders: bool,
            sort: str, direction: str):
    if asset_ids is not None:
        if len(asset_ids) > 5000 or len(set(asset_ids)) != len(asset_ids): raise HTTPException(422, "Invalid selected asset list")
        stmt = select(Asset).where(Asset.id.in_(asset_ids), Asset.deleted_at.is_(None), Asset.status == "active")
    else:
        stmt = select(Asset).where(Asset.deleted_at.is_(None), Asset.status == "active")
        if folder_id:
            ids = [folder_id]
            if include_subfolders:
                frontier = [folder_id]
                while frontier:
                    frontier = list(db.scalars(select(Folder.id).where(Folder.parent_id.in_(frontier), Folder.deleted_at.is_(None))).all())
                    ids.extend(frontier)
            stmt = stmt.where(Asset.folder_id.in_(ids))
    columns = {"filename": Asset.original_filename, "created_at": Asset.created_at, "size": Asset.byte_size, "manual": Asset.display_order, "product_code": Asset.product_code}
    if sort not in columns or direction not in {"asc", "desc"}: raise HTTPException(422, "Invalid export ordering")
    col = columns[sort]
    items = list(db.scalars(stmt.order_by(col.asc() if direction == "asc" else col.desc(), Asset.id.asc()).limit(5001)).all())
    if len(items) > 5000: raise HTTPException(413, "Export is limited to 5000 images")
    if asset_ids is not None:
        rank = {asset_id: index for index, asset_id in enumerate(asset_ids)}
        items.sort(key=lambda asset: rank[asset.id])
    return items

@router.post("/urls/copy-list")
@limiter.limit("30/minute")
def copy_urls(request: Request, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ids = [UUID(str(value)) for value in payload["asset_ids"]] if "asset_ids" in payload else None
    assets = _assets(db, ids, UUID(str(payload["folder_id"])) if payload.get("folder_id") else None,
                     bool(payload.get("include_subfolders", False)), payload.get("sort", "created_at"), payload.get("direction", "desc"))
    kind = payload.get("url_kind", "original")
    if kind not in {"original", "both", "optimized"}: raise HTTPException(422, "Invalid URL kind")
    if kind == "optimized": raise HTTPException(501, "Optimized URLs are available in a later phase")
    values = []
    folder_paths = {}
    if payload.get("include_metadata"):
        folders = {folder.id: folder for folder in db.scalars(select(Folder).where(Folder.deleted_at.is_(None))).all()}
        def path_for(folder_id):
            names=[]; seen=set(); folder=folders.get(folder_id)
            while folder and folder.id not in seen:
                seen.add(folder.id); names.append(folder.name); folder=folders.get(folder.parent_id)
            return "/".join(reversed(names))
        folder_paths = {asset.id: path_for(asset.folder_id) for asset in assets}
    for asset in assets:
        url = _public_url(asset)
        values.append("\t".join([asset.original_filename, asset.product_code or "", folder_paths[asset.id], url]) if payload.get("include_metadata") else f"{url}\n{url}" if kind == "both" else url)
    if payload.get("include_metadata"):
        values.insert(0, "filename\tproduct_code\tfolder_path\toriginal_url")
    if len(values) > 5000: raise HTTPException(413, "URL copy list is too large")
    return {"urls": "\n".join(values), "count": len(values)}

@router.post("/exports")
@limiter.limit("10/minute")
def export_assets(request: Request, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ids = [UUID(str(value)) for value in payload["asset_ids"]] if "asset_ids" in payload else None
    assets = _assets(db, ids, UUID(str(payload["folder_id"])) if payload.get("folder_id") else None,
                     bool(payload.get("include_subfolders", False)), payload.get("sort", "created_at"), payload.get("direction", "desc"))
    fmt = payload.get("format", "csv")
    if fmt == "csv":
        out = StringIO(newline=""); writer = csv.writer(out, lineterminator="\r\n"); writer.writerow(HEADERS); writer.writerows(_rows(assets,db))
        return Response(out.getvalue().encode("utf-8-sig"), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="buildmate-images.csv"'})
    if fmt == "xlsx":
        workbook = Workbook(); sheet = workbook.active; sheet.title = "Images"; sheet.append(HEADERS)
        for cell in sheet[1]: cell.font = Font(bold=True)
        for row in _rows(assets,db): sheet.append(row)
        for row in range(2, sheet.max_row + 1): sheet.cell(row, 3).hyperlink = sheet.cell(row, 3).value; sheet.cell(row, 3).style = "Hyperlink"
        sheet.freeze_panes = "A2"; sheet.auto_filter.ref = sheet.dimensions
        data = BytesIO(); workbook.save(data)
        return Response(data.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": 'attachment; filename="buildmate-images.xlsx"'})
    raise HTTPException(422, "format must be csv or xlsx")


@router.post("/exports/product-mapping")
@limiter.limit("10/minute")
def export_product_mapping(request: Request, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Spreadsheet template for matching external product catalogs to image assets."""
    ids = [UUID(str(value)) for value in payload["asset_ids"]] if "asset_ids" in payload else None
    assets = _assets(db, ids, UUID(str(payload["folder_id"])) if payload.get("folder_id") else None,
                     bool(payload.get("include_subfolders", False)), payload.get("sort", "filename"), payload.get("direction", "asc"))
    headers = ["asset_id", "original_filename", "original_url", "product_code", "product_name", "brand", "product_family", "tags"]
    rows = [[str(a.id), a.original_filename, _public_url(a), a.product_code or "", a.product_name or "", a.brand or "", a.product_family or "", a.tags or "[]"] for a in assets]
    workbook = Workbook(); sheet = workbook.active; sheet.title = "Product mapping"; sheet.append(headers)
    for cell in sheet[1]: cell.font = Font(bold=True)
    for row in rows: sheet.append(row)
    for row in range(2, sheet.max_row + 1):
        cell = sheet.cell(row, 3); cell.hyperlink = cell.value; cell.style = "Hyperlink"
    sheet.freeze_panes = "A2"; sheet.auto_filter.ref = sheet.dimensions
    for column, width in {"A":38,"B":30,"C":55,"D":22,"E":30,"F":22,"G":24,"H":30}.items(): sheet.column_dimensions[column].width = width
    output = BytesIO(); workbook.save(output)
    return Response(output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": 'attachment; filename="buildmate-product-mapping.xlsx"'})
