"""Build chunked embeddings from a worker CSV and upsert only to Pinecone (no Supabase)."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from config.agent_config import VECTOR_STORE_CONFIG


def chunk_text(text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
    """Fixed-size windows with overlap; splits long per-row narratives for embedding."""
    t = (text or "").strip()
    if not t:
        return []
    if chunk_overlap >= chunk_size:
        chunk_overlap = max(0, min(chunk_size // 5, chunk_size - 1))
    if len(t) <= chunk_size:
        return [t]
    chunks: List[str] = []
    i = 0
    n = len(t)
    while i < n:
        end = min(i + chunk_size, n)
        piece = t[i:end].strip()
        if piece:
            chunks.append(piece)
        if end >= n:
            break
        i = end - chunk_overlap
    return chunks


def row_to_rich_text(row: pd.Series) -> str:
    """Deterministic multi-line text from all non-null columns (good for semantic search)."""
    lines: List[str] = []
    for k in row.index:
        v = row[k]
        if pd.isna(v):
            continue
        if isinstance(v, (np.integer, int)):
            lines.append(f"{k}: {int(v)}")
        elif isinstance(v, (np.floating, float)):
            lines.append(f"{k}: {float(v)}")
        elif isinstance(v, (bool, np.bool_)):
            lines.append(f"{k}: {bool(v)}")
        else:
            s = str(v).strip()
            if s:
                lines.append(f"{k}: {s}")
    return "\n".join(lines)


def _stable_row_id(row: pd.Series, row_index: int) -> str:
    if "worker_id" in row.index and not pd.isna(row["worker_id"]):
        try:
            return f"w{int(row['worker_id'])}"
        except (TypeError, ValueError):
            pass
    return f"row{row_index}"


def dataframe_to_chunked_documents(
    df: pd.DataFrame,
    *,
    chunk_size: int,
    chunk_overlap: int,
) -> List[Dict[str, Any]]:
    docs: List[Dict[str, Any]] = []
    for idx, (_, row) in enumerate(df.iterrows()):
        base = _stable_row_id(row, idx)
        full = row_to_rich_text(row)
        parts = chunk_text(full, chunk_size, chunk_overlap)
        if not parts:
            continue
        wid_meta: Optional[int] = None
        if "worker_id" in row.index and not pd.isna(row.get("worker_id")):
            try:
                wid_meta = int(row["worker_id"])
            except (TypeError, ValueError):
                wid_meta = None
        city = row.get("city")
        city_s = str(city).strip()[:128] if city is not None and not pd.isna(city) else ""

        for ci, chunk in enumerate(parts):
            meta: Dict[str, Any] = {
                "chunk_index": ci,
                "num_chunks": len(parts),
                "csv_row_index": idx,
                "city": city_s,
            }
            if wid_meta is not None:
                meta["worker_id"] = wid_meta
            docs.append(
                {
                    "id": f"csv_{base}_c{ci}",
                    "text": chunk,
                    "metadata": meta,
                }
            )
    return docs


def run_populate_pinecone_from_csv(
    csv_path: Path,
    *,
    limit: Optional[int] = None,
    chunk_size: Optional[int] = None,
    chunk_overlap: Optional[int] = None,
    batch_size: int = 128,
    category: str = "historical_claims",
) -> None:
    from src.utils.schema import ensure_worker_columns
    from src.rag.rag_system import VectorStore

    os.environ["VECTOR_STORE_PROVIDER"] = "pinecone"

    cfg = VECTOR_STORE_CONFIG
    cs = int(chunk_size if chunk_size is not None else cfg.get("chunk_size") or 500)
    ov = int(chunk_overlap if chunk_overlap is not None else cfg.get("chunk_overlap") or 50)
    if batch_size < 1:
        batch_size = 128

    df = ensure_worker_columns(pd.read_csv(csv_path))
    if limit is not None and limit > 0:
        df = df.head(limit)
    before = len(df)
    if "worker_id" in df.columns:
        df = df.drop_duplicates(subset=["worker_id"], keep="last")
    n = len(df)
    print(
        f"Loaded {before} rows from {csv_path}"
        + (f" ({before - n} duplicate worker_id dropped, {n} unique)" if before != n else "")
    )

    docs = dataframe_to_chunked_documents(df, chunk_size=cs, chunk_overlap=ov)
    print(f"Chunking: size={cs} overlap={ov} → {len(docs)} vectors (category={category})")

    if not docs:
        print("No documents to upsert.")
        return

    vs = VectorStore(provider="pinecone")
    for i in range(0, len(docs), batch_size):
        batch = docs[i : i + batch_size]
        vs.add_documents(batch, category=category)
        print(f"  upserted {min(i + batch_size, len(docs))}/{len(docs)}")

    print("Pinecone populate from CSV finished.")
