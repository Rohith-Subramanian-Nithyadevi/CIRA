# ── backend-ai/Dockerfile ─────────────────────────────────────────────────────
# Multi-stage build:
#   Stage 1 (builder) — install dependencies into a venv
#   Stage 2 (runtime) — copy only the venv and source, no build tools
#
# Why multi-stage?
#   sentence-transformers pulls in torch (~1 GB). Building in a separate stage
#   keeps the final image lean — we don't ship pip, compilers, or build caches.

# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build tools needed by some packages (e.g. numpy C extensions)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment so we can copy it cleanly to the runtime stage
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Copy the pre-built venv from the builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application source
COPY src/ ./src/
COPY .env.example .env.example

# Pre-download the sentence-transformer model at build time so the first
# request doesn't block waiting for a 80 MB download.
# Remove this RUN line if you prefer lazy downloading at runtime.
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('all-MiniLM-L6-v2'); \
print('Model cached.')"

EXPOSE 8000

# Use a non-root user for security
RUN useradd -m appuser
USER appuser

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
