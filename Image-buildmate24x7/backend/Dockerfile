FROM python:3.12-slim AS app-base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY alembic.ini ./alembic.ini
COPY migrations ./migrations

FROM app-base AS runtime
COPY entrypoint.sh ./entrypoint.sh
RUN chmod 0555 ./entrypoint.sh && useradd --create-home --uid 10001 appuser
USER 10001:10001
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]

FROM app-base AS test
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY tests ./tests
CMD ["python", "-m", "pytest", "-q"]
