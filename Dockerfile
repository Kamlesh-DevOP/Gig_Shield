# ── GigShield Backend — Production Dockerfile ────────────────────────
# Optimised for Render (free-tier 512 MB RAM) by splitting heavy
# deps into a cached layer and using --no-cache-dir throughout.
# ─────────────────────────────────────────────────────────────────────

FROM python:3.11-slim AS base

# Prevents Python from buffering stdout/stderr (important for Render logs)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System deps needed by numpy/scipy/lightgbm/h5py (tensorflow)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libgomp1 \
        libhdf5-dev \
        pkg-config \
        git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── 1. Install Python deps (cached unless requirements change) ──────
COPY requirements-render.txt ./requirements-render.txt
RUN pip install --upgrade pip setuptools wheel \
    && pip install -r requirements-render.txt

# ── 2. Copy application sources ────────────────────────────────────
COPY . .

# ── 3. Ensure runtime directories exist ─────────────────────────────
RUN mkdir -p data/raw data/processed data/features data/outputs \
             models/income_forecasting models/risk_scoring \
             models/fraud_detection models/disruption_impact \
             models/behavior_analysis models/premium_prediction \
             logs vector_store/chromadb

# ── 4. Pre-download SentenceTransformer model (avoid runtime timeout) ──
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# ── 5. Render uses PORT env var (default 10000) ─────────────────────
ENV PORT=10000
EXPOSE ${PORT}

# ── 6. Start uvicorn ────────────────────────────────────────────────
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1 --timeout-keep-alive 120"]
