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
