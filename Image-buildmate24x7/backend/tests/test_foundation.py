from io import BytesIO
import json

from PIL import Image
from fastapi.testclient import TestClient

from app.database import engine
from app.main import app
from app.models import Base


def test_health_endpoints():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as client:
        assert client.get("/health/live").json() == {"status": "ok"}
        assert client.get("/health/ready").json() == {"status": "ready"}


def test_admin_login_me_and_logout_revokes_session():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as client:
        rejected = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "wrong-password"})
        assert rejected.status_code == 401

        login = client.post(
            "/api/v1/auth/login",
            json={"email": "ADMIN@example.com", "password": "test-bootstrap-password-strong"},
        )
        assert login.status_code == 200
        result = login.json()
        assert result["token_type"] == "bearer"
        assert result["user"]["email"] == "admin@example.com"

        headers = {"Authorization": f"Bearer {result['access_token']}"}
        assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
        assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
        assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_admin_route_rejects_missing_credentials():
    with TestClient(app) as client:
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401


def test_validation_errors_do_not_echo_password_input():
    secret_value = "x" * 1025
    with TestClient(app) as client:
        response = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": secret_value})
        assert response.status_code == 422
        assert secret_value not in response.text


def test_password_change_revokes_sessions_and_allows_new_password():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "test-bootstrap-password-strong"},
        )
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        changed = client.post(
            "/api/v1/auth/password",
            headers=headers,
            json={"current_password": "test-bootstrap-password-strong", "new_password": "new-password-that-is-long-enough"},
        )
        assert changed.status_code == 204
        assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
        new_login = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "new-password-that-is-long-enough"},
        )
        assert new_login.status_code == 200


def _admin_headers(client):
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "test-bootstrap-password-strong"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_folder_create_nested_list_and_counts():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app, client=("198.51.100.11", 5000)) as client:
        headers = _admin_headers(client)
        root = client.post("/api/v1/folders", headers=headers, json={"name": "Electrical"})
        assert root.status_code == 201
        parent_id = root.json()["id"]
        nested = client.post("/api/v1/folders", headers=headers, json={"name": "Switches", "parent_id": parent_id})
        assert nested.status_code == 201
        result = client.get("/api/v1/folders", headers=headers).json()
        assert result["total"] == 2
        assert next(item for item in result["items"] if item["id"] == parent_id)["children_count"] == 1
        assert nested.json()["image_count"] == 0
        direct_children = client.get(f"/api/v1/folders?parent_id={parent_id}", headers=headers).json()
        assert [item["name"] for item in direct_children["items"]] == ["Switches"]


def test_folder_names_are_unique_case_insensitively_per_parent():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app, client=("198.51.100.12", 5000)) as client:
        headers = _admin_headers(client)
        first = client.post("/api/v1/folders", headers=headers, json={"name": "Electrical"})
        assert first.status_code == 201
        duplicate = client.post("/api/v1/folders", headers=headers, json={"name": "  ELECTRICAL  "})
        assert duplicate.status_code == 409
        parent = first.json()["id"]
        assert client.post("/api/v1/folders", headers=headers, json={"name": "Electrical", "parent_id": parent}).status_code == 201


def test_folder_rename_move_and_cycle_protection():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app, client=("198.51.100.13", 5000)) as client:
        headers = _admin_headers(client)
        root_a = client.post("/api/v1/folders", headers=headers, json={"name": "A"}).json()
        root_b = client.post("/api/v1/folders", headers=headers, json={"name": "B"}).json()
        child = client.post("/api/v1/folders", headers=headers, json={"name": "Child", "parent_id": root_a["id"]}).json()
        cycle = client.patch(f"/api/v1/folders/{root_a['id']}", headers=headers, json={"parent_id": child["id"]})
        assert cycle.status_code == 409
        moved = client.patch(
            f"/api/v1/folders/{child['id']}",
            headers=headers,
            json={"name": "Renamed", "parent_id": root_b["id"]},
        )
        assert moved.status_code == 200
        assert moved.json()["name"] == "Renamed"
        assert moved.json()["parent_id"] == root_b["id"]


def test_folder_delete_requires_no_subfolders_and_is_soft():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app, client=("198.51.100.14", 5000)) as client:
        headers = _admin_headers(client)
        parent = client.post("/api/v1/folders", headers=headers, json={"name": "Parent"}).json()
        child = client.post("/api/v1/folders", headers=headers, json={"name": "Child", "parent_id": parent["id"]}).json()
        assert client.delete(f"/api/v1/folders/{parent['id']}", headers=headers).status_code == 409
        assert client.delete(f"/api/v1/folders/{child['id']}", headers=headers).status_code == 204
        active_ids = {folder["id"] for folder in client.get("/api/v1/folders", headers=headers).json()["items"]}
        assert child["id"] not in active_ids
        assert client.delete(f"/api/v1/folders/{parent['id']}", headers=headers).status_code == 204
        assert client.get("/api/v1/folders", headers=headers).json()["total"] == 0


def test_folder_reorder_persists_for_all_siblings():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app, client=("198.51.100.15", 5000)) as client:
        headers = _admin_headers(client)
        names = ["One", "Two", "Three"]
        created = [client.post("/api/v1/folders", headers=headers, json={"name": name}).json() for name in names]
        reversed_items = list(reversed(created))
        response = client.post(
            "/api/v1/folders/reorder",
            headers=headers,
            json={"items": [{"id": folder["id"], "display_order": index * 1000} for index, folder in enumerate(reversed_items)]},
        )
        assert response.status_code == 204
        listed = client.get("/api/v1/folders", headers=headers).json()["items"]
        assert [folder["name"] for folder in listed] == ["Three", "Two", "One"]


def _png_bytes(color=(30, 90, 170)):
    output = BytesIO()
    Image.new("RGB", (9, 7), color).save(output, format="PNG")
    return output.getvalue()


def test_upload_requires_authentication(monkeypatch, tmp_path):
    from app.config import settings

    monkeypatch.setattr(settings, "storage_root", tmp_path)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as client:
        response = client.post("/api/v1/uploads", files={"files[]": ("x.png", _png_bytes(), "image/png")})
        assert response.status_code == 401


def test_upload_registers_immutable_asset_and_stable_original(monkeypatch, tmp_path):
    from app.config import settings

    monkeypatch.setattr(settings, "storage_root", tmp_path)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app, client=("198.51.100.16", 5000)) as client:
        headers = _admin_headers(client)
        folder = client.post("/api/v1/folders", headers=headers, json={"name": "Products"}).json()
        response = client.post(
            "/api/v1/uploads", headers=headers,
            data={"folder_id": folder["id"], "metadata": '{"product_code":"SW-9","tags":["switch","white"]}'},
            files={"files[]": ("spoofed.jpg", _png_bytes(), "application/octet-stream")},
        )
        assert response.status_code == 200
        result = response.json()
        assert (result["succeeded"], result["failed"]) == (1, 0)
        asset = result["results"][0]["asset"]
        assert asset["format"] == "png" and asset["media_type"] == "image/png"
        assert asset["width"] == 9 and asset["height"] == 7
        assert asset["product_code"] == "SW-9" and asset["tags"] == ["switch", "white"]
        assert asset["original_url"].endswith(f"/original/{asset['id']}.png")
        original = client.get(f"/original/{asset['id']}.png")
        assert original.status_code == 200 and original.content == _png_bytes()
        assert original.headers["cache-control"].endswith("immutable")
        folders = client.get("/api/v1/folders", headers=headers).json()
        assert next(item for item in folders["items"] if item["id"] == folder["id"])["image_count"] == 1
        assert client.delete(f"/api/v1/folders/{folder['id']}", headers=headers).status_code == 409


def test_bulk_upload_partial_failures_and_duplicate_warning(monkeypatch, tmp_path):
    from app.config import settings

    monkeypatch.setattr(settings, "storage_root", tmp_path)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    image = _png_bytes()
    with TestClient(app, client=("198.51.100.17", 5000)) as client:
        headers = _admin_headers(client)
        response = client.post(
            "/api/v1/uploads", headers=headers,
            files=[("files[]", ("first.png", image, "image/png")),
                   ("files[]", ("bad.png", b"not an image", "image/png")),
                   ("files[]", ("duplicate.png", image, "image/png"))],
        )
        assert response.status_code == 200
        body = response.json()
        assert (body["succeeded"], body["failed"]) == (2, 1)
        assert body["results"][1]["status"] == "failed"
        assert body["results"][2]["duplicate_warning"] is True
        assert body["results"][0]["asset"]["id"] != body["results"][2]["asset"]["id"]


def test_upload_rejects_mime_or_extension_spoof_and_bad_metadata(monkeypatch, tmp_path):
    from app.config import settings

    monkeypatch.setattr(settings, "storage_root", tmp_path)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app, client=("198.51.100.18", 5000)) as client:
        headers = _admin_headers(client)
        spoof = client.post("/api/v1/uploads", headers=headers, files={"files[]": ("x.exe", b"MZ invalid", "image/png")})
        assert spoof.json()["failed"] == 1
        invalid_metadata = client.post(
            "/api/v1/uploads", headers=headers, data={"metadata": '{"unknown":"value"}'},
            files={"files[]": ("x.png", _png_bytes(), "image/png")},
        )
        assert invalid_metadata.status_code == 422
        assert list((tmp_path / "originals").glob("*")) == []


def test_bulk_upload_accepts_per_file_metadata(monkeypatch, tmp_path):
    from app.config import settings

    monkeypatch.setattr(settings, "storage_root", tmp_path)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app, client=("198.51.100.19", 5000)) as client:
        headers = _admin_headers(client)
        response = client.post(
            "/api/v1/uploads", headers=headers,
            data={"metadata": '[{"product_code":"A"},{"product_code":"B"}]'},
            files=[("files[]", ("a.png", _png_bytes((1, 2, 3)), "image/png")),
                   ("files[]", ("b.png", _png_bytes((4, 5, 6)), "image/png"))],
        )
        assert response.status_code == 200
        assert [item["asset"]["product_code"] for item in response.json()["results"]] == ["A", "B"]


def test_upload_enforces_configured_byte_and_pixel_limits(monkeypatch, tmp_path):
    from app.config import settings

    monkeypatch.setattr(settings, "storage_root", tmp_path)
    monkeypatch.setattr(settings, "upload_max_bytes", 20)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app, client=("198.51.100.20", 5000)) as client:
        headers = _admin_headers(client)
        too_large = client.post("/api/v1/uploads", headers=headers, files={"files[]": ("large.png", _png_bytes(), "image/png")})
        assert too_large.json()["results"][0]["error"] == "File exceeds the configured upload size limit"
        monkeypatch.setattr(settings, "upload_max_bytes", 52_428_800)
        monkeypatch.setattr(settings, "upload_max_pixels", 10)
        too_many_pixels = client.post("/api/v1/uploads", headers=headers, files={"files[]": ("pixels.png", _png_bytes(), "image/png")})
        assert too_many_pixels.json()["results"][0]["error"] == "Image dimensions exceed the configured pixel limit"
        assert list((tmp_path / "originals").glob("*")) == []


def test_gallery_search_filter_detail_and_metadata_update(monkeypatch, tmp_path):
    from app.config import settings
    monkeypatch.setattr(settings, "storage_root", tmp_path)
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
    with TestClient(app, client=("198.51.100.21", 5000)) as client:
        headers = _admin_headers(client)
        upload = client.post("/api/v1/uploads", headers=headers, files={"files[]": ("lamp.png", _png_bytes(), "image/png")}).json()
        asset_id = upload["results"][0]["asset"]["id"]
        listed = client.get("/api/v1/assets?q=lamp&format=png", headers=headers)
        assert listed.status_code == 200 and listed.json()["total"] == 1
        detail = client.get(f"/api/v1/assets/{asset_id}", headers=headers)
        assert detail.status_code == 200
        changed = client.patch(f"/api/v1/assets/{asset_id}", headers=headers, json={"product_code":"L-1","tags":["lighting"]})
        assert changed.json()["product_code"] == "L-1" and changed.json()["tags"] == ["lighting"]


def test_exports_csv_xlsx_and_deterministic_selected_urls(monkeypatch, tmp_path):
    from app.config import settings
    monkeypatch.setattr(settings, "storage_root", tmp_path)
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
    with TestClient(app, client=("198.51.100.22", 5000)) as client:
        headers = _admin_headers(client)
        ids=[]
        for name, code in (("b.png","B"),("a.png","A")):
            result=client.post("/api/v1/uploads",headers=headers,data={"metadata":'{"product_code":"'+code+'"}'},files={"files[]":(name,_png_bytes((len(ids)+1,4,5)),"image/png")}).json()
            ids.append(result["results"][0]["asset"]["id"])
        copied=client.post("/api/v1/urls/copy-list",headers=headers,json={"asset_ids":ids})
        assert copied.status_code==200 and copied.json()["count"]==2
        assert copied.json()["urls"].splitlines()[0].endswith(f"/{ids[0]}.png")
        copied_again=client.post("/api/v1/urls/copy-list",headers=headers,json={"asset_ids":ids})
        assert copied_again.json()["urls"] == copied.json()["urls"]
        csv_response=client.post("/api/v1/exports",headers=headers,json={"asset_ids":ids,"format":"csv"})
        assert csv_response.status_code==200 and "product_code" in csv_response.content.decode("utf-8-sig")
        xlsx_response=client.post("/api/v1/exports",headers=headers,json={"asset_ids":ids,"format":"xlsx"})
        assert xlsx_response.status_code==200 and xlsx_response.content[:2]==b"PK"


def test_product_mapping_export_contains_optional_metadata_and_order(monkeypatch, tmp_path):
    from app.config import settings
    from openpyxl import load_workbook
    monkeypatch.setattr(settings, "storage_root", tmp_path)
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
    with TestClient(app, client=("198.51.100.23", 5000)) as client:
        headers = _admin_headers(client)
        ids=[]
        for name, code in (("z.png","Z"),("a.png","A")):
            data={"metadata":json.dumps({"product_code":code,"product_name":"Name "+code,"brand":"BuildMate","product_family":"Lights","tags":["catalog"]})}
            result=client.post("/api/v1/uploads",headers=headers,data=data,files={"files[]":(name,_png_bytes((len(ids)+10,2,3)),"image/png")}).json()
            ids.append(result["results"][0]["asset"]["id"])
        response=client.post("/api/v1/exports/product-mapping",headers=headers,json={"asset_ids":ids})
        assert response.status_code==200
        sheet=load_workbook(BytesIO(response.content),read_only=True).active
        rows=list(sheet.values)
        assert rows[0]==("asset_id","original_filename","original_url","product_code","product_name","brand","product_family","tags")
        assert [row[3] for row in rows[1:]]==["Z","A"]
        assert rows[1][5:]==("BuildMate","Lights",'["catalog"]')


def test_media_derivative_is_cached_and_original_is_unchanged(monkeypatch, tmp_path):
    from app.config import settings
    monkeypatch.setattr(settings, "storage_root", tmp_path)
    monkeypatch.setattr(settings, "imgproxy_base_url", None)
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
    original_bytes = _png_bytes()
    with TestClient(app, client=("198.51.100.24", 5000)) as client:
        headers = _admin_headers(client)
        upload=client.post("/api/v1/uploads",headers=headers,files={"files[]":("photo.png",original_bytes,"image/png")}).json()
        asset=upload["results"][0]["asset"]
        derivative=client.get(f"/media/{asset['id']}?preset=thumbnail&format=webp")
        assert derivative.status_code==200 and derivative.headers["content-type"].startswith("image/webp")
        assert len(list((tmp_path/"cache").glob("*.webp")))==1
        assert client.get(f"/media/{asset['id']}?preset=thumbnail&format=webp").content==derivative.content
        assert client.get(f"/original/{asset['id']}.png").content==original_bytes
        assert client.get(f"/media/{asset['id']}?w=99999").status_code==422


def test_production_security_headers_and_no_store_health():
    with TestClient(app) as client:
        response=client.get("/health/live")
        assert response.status_code==200
        assert response.headers["cache-control"]=="no-store"
        assert response.headers["x-content-type-options"]=="nosniff"
        assert response.headers["x-frame-options"]=="DENY"
