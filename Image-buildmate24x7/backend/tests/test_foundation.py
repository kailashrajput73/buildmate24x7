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
