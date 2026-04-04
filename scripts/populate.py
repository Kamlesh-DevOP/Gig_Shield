"""
Populate Pinecone only from a worker CSV: rich row text → chunked embeddings → upsert.

Does not touch Supabase or the curated knowledge_bundle.

Prerequisites (.env):
  VECTOR_STORE_PROVIDER=pinecone (this script forces pinecone for the run)
  PINECONE_API_KEY, PINECONE_HOST (or index name via PINECONE_INDEX_NAME)
  Match embedding dim to your index (see rag_system / PINECONE_INDEX_DIMENSION)

Default category is historical_claims so claim-validation RAG can retrieve these chunks.

From repo root (venv active):

  python scripts/populate.py --csv data/raw/quick_commerce_synthetic_data52k.csv --limit 5000

  python scripts/populate.py --csv data/raw/quick_commerce_synthetic_data52k.csv --batch-size 64 --chunk-size 400 --chunk-overlap 40

  python scripts/populate.py --category fraud_cases
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
    from src.pipeline.populate_pinecone_csv import run_populate_pinecone_from_csv

    p = argparse.ArgumentParser(description="Populate Pinecone from CSV (chunked vectors only)")
    p.add_argument("--csv", type=Path, default=ROOT / "data" / "raw" / "final_dataset.csv")
    p.add_argument("--limit", type=int, default=None, help="Max rows after load (before worker_id dedupe)")
    p.add_argument("--chunk-size", type=int, default=None, help="Chars per chunk (default: agent_config VECTOR_STORE_CONFIG chunk_size)")
    p.add_argument("--chunk-overlap", type=int, default=None, help="Overlap between chunks")
    p.add_argument("--batch-size", type=int, default=128, help="Vectors per embed/upsert batch")
    p.add_argument(
        "--category",
        type=str,
        default="historical_claims",
        help="Pinecone metadata category (default historical_claims for claim RAG)",
    )
    args = p.parse_args()

    csv_path = args.csv
    if not csv_path.is_file():
        alt = ROOT / "data" / "raw" / "quick_commerce_synthetic_data52k.csv"
        if alt.is_file():
            print(f"CSV not found at {csv_path}, using {alt}")
            csv_path = alt
        else:
            raise SystemExit(f"CSV not found: {csv_path}")

    run_populate_pinecone_from_csv(
        csv_path,
        limit=args.limit,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        batch_size=args.batch_size,
        category=args.category.strip(),
    )


if __name__ == "__main__":
    main()
