# Stage 1: third-party front-end assets (GSAP, Lenis, fonts) come from npm at build time,
# pinned by package-lock.json, instead of being committed to the repository.
FROM node:26.13.1-slim AS assets
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
RUN npm run vendor

# Stage 2: the app. Python only at runtime.
FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /bin/uv
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --locked --no-dev --no-install-project
COPY src ./src
COPY --from=assets /build/src/aegis/static/vendor ./src/aegis/static/vendor
RUN uv sync --locked --no-dev
RUN useradd --create-home appuser
USER appuser
ENV PATH=/app/.venv/bin:$PATH PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn aegis.api:app --host 0.0.0.0 --port ${PORT}"]
