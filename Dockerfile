# Stage 1: the front end. React and its build tools exist only here; the build writes static
# files (prerendered pages, hashed assets, fonts) into src/aegis/static.
FROM node:26.13.1-slim AS web
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY vite.config.ts tsconfig.json ./
COPY web ./web
RUN npm run build

# Stage 2: the app. Python only at runtime.
FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /bin/uv
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --locked --no-dev --no-install-project
COPY src ./src
COPY --from=web /build/src/aegis/static ./src/aegis/static
RUN uv sync --locked --no-dev
RUN useradd --create-home appuser
USER appuser
ENV PATH=/app/.venv/bin:$PATH PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn aegis.main:app --host 0.0.0.0 --port ${PORT}"]
