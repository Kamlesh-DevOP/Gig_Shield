"""
CLI: load CSV into Supabase (gic_workers) and upsert RAG vectors to Pinecone.

Prerequisites
  - Supabase: run supabase/migrations/001_gic.sql and 002_gic_workers.sql
  - .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  - Pinecone: VECTOR_STORE_PROVIDER=pinecone, PINECONE_API_KEY, PINECONE_HOST
  - If your index is 1024-d: PINECONE_INDEX_DIMENSION=1024 in .env

Examples (from repo root, venv active):

  python scripts/populate_supabase_pinecone.py --csv data/raw/quick_commerce_synthetic_data52k.csv --limit 10000

  python scripts/populate_supabase_pinecone.py --skip-supabase

  python scripts/populate_supabase_pinecone.py --skip-pinecone

  python scripts/populate_supabase_pinecone.py --worker-vectors --worker-vector-limit 2000

  python scripts/populate_supabase_pinecone.py --skip-knowledge --worker-vectors --worker-vector-limit 500
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")


def main() -> None:
    from src.pipeline.populate_data_stores import run_populate

    p = argparse.ArgumentParser(description="Populate Supabase + Pinecone from CSV")
    p.add_argument("--csv", type=Path, default=ROOT / "data" / "raw" / "final_dataset.csv")
    p.add_argument("--limit", type=int, default=None, help="Max rows from CSV (after load, before dedupe)")
    p.add_argument("--skip-supabase", action="store_true")
    p.add_argument("--skip-pinecone", action="store_true", help="Skip curated KB + worker vectors")
    p.add_argument("--skip-knowledge", action="store_true", help="Skip knowledge_bundle only; still run worker vectors if --worker-vectors")
    p.add_argument("--worker-vectors", action="store_true", help="Embed per-row summaries (category dataset_workers)")
    p.add_argument("--worker-vector-limit", type=int, default=2000)
    args = p.parse_args()

    csv_path = args.csv
    if not csv_path.is_file():
        alt = ROOT / "data" / "raw" / "quick_commerce_synthetic_data52k.csv"
        if alt.is_file():
            print(f"CSV not found at {csv_path}, using {alt}")
            csv_path = alt
        else:
            raise SystemExit(f"CSV not found: {csv_path}")

    run_populate(
        csv_path=csv_path,
        limit=args.limit,
        do_supabase=not args.skip_supabase,
        do_pinecone_kb=not args.skip_pinecone and not args.skip_knowledge,
        do_worker_vectors=not args.skip_pinecone and args.worker_vectors,
        worker_vector_limit=args.worker_vector_limit,
    )
    print("Done.")


if __name__ == "__main__":
    main()
