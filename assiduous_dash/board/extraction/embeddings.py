"""
Gemini embedding client for the hybrid RAG layer.

Save as: board/extraction/embeddings.py

Uses gemini-embedding-001 truncated to 1536 dimensions via MRL
(output_dimensionality) so the vectors fit VectorDocumentChunk's
pgvector column. Truncated MRL vectors are NOT unit-length, so they're
re-normalized here — without that, cosine distance over the truncated
prefix is skewed and pgvector's vector_cosine_ops ordering degrades.

Same retry-with-backoff-then-wrap-RuntimeError convention as every
other Gemini call site (gemini_client.extract_statement,
commentary.generate_commentary, advisory/roadmap) — callers catch the
RuntimeError and record it rather than letting it propagate.
"""

import math
import time
from typing import Optional

from google.genai import types

from .gemini_client import _get_client

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSIONS = 1536


def _l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        return vector
    return [v / norm for v in vector]


def embed_text(text: str, task_type: str = "RETRIEVAL_DOCUMENT", max_retries: int = 2) -> list[float]:
    """
    Embeds `text` and returns a unit-length 1536-dim vector.

    task_type is Gemini's asymmetric-retrieval hint: documents are
    embedded with RETRIEVAL_DOCUMENT at ingest time, queries with
    RETRIEVAL_QUERY at search time (see retrieval.execute_hybrid_rag_query).
    """
    client = _get_client()

    last_error: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            response = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=text,
                config=types.EmbedContentConfig(
                    output_dimensionality=EMBEDDING_DIMENSIONS,
                    task_type=task_type,
                ),
            )
            values = list(response.embeddings[0].values)
            if len(values) != EMBEDDING_DIMENSIONS:
                raise ValueError(
                    f"Expected {EMBEDDING_DIMENSIONS}-dim embedding, got {len(values)}"
                )
            return _l2_normalize(values)
        except Exception as exc:  # noqa: BLE001 - wrapped and re-raised below, house convention
            last_error = exc
            if attempt < max_retries:
                time.sleep(2 ** (attempt + 1))
                continue
            raise RuntimeError(
                f"Gemini embedding failed after {max_retries + 1} attempt(s): {last_error}"
            ) from last_error
