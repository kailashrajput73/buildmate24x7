from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from uuid import UUID
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Asset, AssetCollection, AuditEvent, Collection, User
from app.uploads import AssetSummary, _asset_summary

router=APIRouter(prefix="/api/v1",tags=["asset-actions"],dependencies=[Depends(get_current_user)])

class CollectionCreate(BaseModel):
    name:str=Field(min_length=1,max_length=120)
    description:str|None=Field(default=None,max_length=1000)

class Membership(BaseModel):
    asset_ids:list[UUID]=Field(min_length=1,max_length=500)

class DeletedAssets(BaseModel):
    asset_ids:list[UUID]=Field(min_length=1,max_length=500)

@router.get("/collections")
def list_collections(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    rows=db.execute(select(Collection,func.count(AssetCollection.asset_id)).outerjoin(AssetCollection).group_by(Collection.id).order_by(Collection.name)).all()
    return {"items":[{"id":str(c.id),"name":c.name,"description":c.description,"asset_count":n} for c,n in rows]}

@router.post("/collections",status_code=201)
def create_collection(payload:CollectionCreate,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    name=payload.name.strip()
    if not name: raise HTTPException(422,"Collection name cannot be empty")
    if db.scalar(select(Collection.id).where(func.lower(Collection.name)==name.lower())): raise HTTPException(409,"Collection already exists")
    item=Collection(name=name,description=payload.description,created_by=user.id);db.add(item);db.commit();db.refresh(item)
    return {"id":str(item.id),"name":item.name,"description":item.description,"asset_count":0}

@router.get("/collections/{collection_id}/assets")
def collection_assets(collection_id:UUID,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    if db.get(Collection,collection_id) is None: raise HTTPException(404,"Collection not found")
    assets=db.scalars(select(Asset).join(AssetCollection,AssetCollection.asset_id==Asset.id).where(AssetCollection.collection_id==collection_id,Asset.deleted_at.is_(None)).order_by(Asset.original_filename,Asset.id)).all()
    return {"items":[_asset_summary(a) for a in assets],"total":len(assets)}

@router.post("/collections/{collection_id}/assets",status_code=204)
def add_collection_assets(collection_id:UUID,payload:Membership,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    if db.get(Collection,collection_id) is None: raise HTTPException(404,"Collection not found")
    assets=list(db.scalars(select(Asset).where(Asset.id.in_(payload.asset_ids),Asset.deleted_at.is_(None))).all())
    if len(assets)!=len(set(payload.asset_ids)): raise HTTPException(404,"One or more images were not found")
    existing=set(db.scalars(select(AssetCollection.asset_id).where(AssetCollection.collection_id==collection_id,AssetCollection.asset_id.in_(payload.asset_ids))).all())
    db.add_all([AssetCollection(asset_id=a.id,collection_id=collection_id) for a in assets if a.id not in existing]);db.commit()

@router.delete("/collections/{collection_id}/assets/{asset_id}",status_code=204)
def remove_collection_asset(collection_id:UUID,asset_id:UUID,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    row=db.get(AssetCollection,(asset_id,collection_id))
    if row: db.delete(row);db.commit()

@router.delete("/collections/{collection_id}",status_code=204)
def delete_collection(collection_id:UUID,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.get(Collection,collection_id)
    if item is None: raise HTTPException(404,"Collection not found")
    db.delete(item);db.commit()

@router.get("/trash")
def list_trash(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    assets=db.scalars(select(Asset).where(Asset.deleted_at.is_not(None)).order_by(Asset.deleted_at.desc()).limit(500)).all()
    return {"items":[_asset_summary(a) for a in assets],"total":len(assets)}

@router.get("/audit")
def audit_history(limit:int=100,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    if limit<1 or limit>500: raise HTTPException(422,"Limit must be between 1 and 500")
    rows=db.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc(),AuditEvent.id.desc()).limit(limit)).all()
    return {"items":[{"id":str(row.id),"actor_id":str(row.actor_id) if row.actor_id else None,"entity_type":row.entity_type,"entity_id":row.entity_id,"action":row.action,"details":row.details,"created_at":row.created_at.isoformat()} for row in rows]}

@router.post("/assets/bulk-delete")
def trash_assets(payload:DeletedAssets,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    assets=list(db.scalars(select(Asset).where(Asset.id.in_(payload.asset_ids),Asset.deleted_at.is_(None))).all())
    if len(assets)!=len(set(payload.asset_ids)): raise HTTPException(404,"One or more images were not found")
    now=datetime.now(UTC)
    for asset in assets:
        asset.deleted_at=now
        db.add(AuditEvent(actor_id=user.id,entity_type="asset",entity_id=str(asset.id),action="trashed"))
    db.commit();return {"deleted":len(assets)}

@router.post("/assets/bulk-download")
def bulk_download(payload:Membership,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    if len(payload.asset_ids)>100: raise HTTPException(422,"Select at most 100 images per download")
    assets=list(db.scalars(select(Asset).where(Asset.id.in_(payload.asset_ids),Asset.deleted_at.is_(None),Asset.status=="active")).all())
    if len(assets)!=len(set(payload.asset_ids)): raise HTTPException(404,"One or more images were not found")
    if sum(a.byte_size for a in assets)>250*1024*1024: raise HTTPException(413,"Selected originals exceed the 250 MiB download limit")
    by_id={a.id:a for a in assets};output=BytesIO()
    with ZipFile(output,"w",ZIP_DEFLATED) as archive:
        for asset_id in payload.asset_ids:
            asset=by_id[asset_id];path=(settings.storage_root/"originals"/asset.storage_key).resolve()
            if path.parent!=(settings.storage_root/"originals").resolve() or not path.is_file(): raise HTTPException(404,"An original file is unavailable")
            name=Path(asset.display_name or asset.original_filename).name
            archive.write(path,f"{asset.id}_{name}")
    output.seek(0)
    return StreamingResponse(output,media_type="application/zip",headers={"Content-Disposition":"attachment; filename=buildmate-selected-images.zip","Cache-Control":"no-store"})

@router.post("/assets/{asset_id}/restore",response_model=AssetSummary)
def restore_asset(asset_id:UUID,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    asset=db.scalar(select(Asset).where(Asset.id==asset_id,Asset.deleted_at.is_not(None)))
    if asset is None: raise HTTPException(404,"Trashed image not found")
    asset.deleted_at=None;db.add(AuditEvent(actor_id=user.id,entity_type="asset",entity_id=str(asset.id),action="restored"));db.commit();db.refresh(asset);return _asset_summary(asset)
