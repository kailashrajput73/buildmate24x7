import os

os.environ.setdefault("IMAGE_CLOUD_DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("IMAGE_CLOUD_JWT_SECRET", "test-secret-value-with-at-least-32-bytes-long")
os.environ.setdefault("IMAGE_CLOUD_BOOTSTRAP_ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault("IMAGE_CLOUD_BOOTSTRAP_ADMIN_PASSWORD", "test-bootstrap-password-strong")
os.environ.setdefault("IMAGE_CLOUD_CORS_ORIGINS", '["http://testserver"]')
