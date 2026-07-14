"""
Hybrid Vector + Graph RAG retrieval.

Save as: board/extraction/retrieval.py

execute_hybrid_rag_query() fuses three data dimensions into one
prompt-ready context block:

1. Deterministic figures — the already-validated statement rows,
   via commentary._outlook_summary (the same aggregate advisory.py and
   roadmap.py trust; never re-derived here).
2. Vector search — cosine similarity over VectorDocumentChunk. On
   Postgres this is pgvector's `<=>` operator through the ORM's
   CosineDistance (HNSW-indexed, see migration 0022); on the SQLite
   dev/test database it falls back to brute-force cosine in Python —
   identical contract, so the full path runs under pytest without a
   Postgres service.
3. Graph traversal — breadth-first walk of KnowledgeGraphEdge from
   seed nodes (nodes citing the retrieved chunks, plus nodes named in
   the query), bounded by graph_depth, cycle-safe.

Isolation contract: every chunk query is scoped to the given period
(plus period-null "global" documents like rulebooks — that inclusion
is deliberate and documented); another period's chunks are never
returned. This app is single-tenant (one company), so scoping is by
period, not a tenant id — there is no Company model to filter on.

Deliberately does NOT call Gemini for generation — retrieval and
generation stay separate calls with separate inputs, the same
failure-mode isolation rule that keeps extraction and commentary
separate (README §1). Callers hand the returned context to
generate_content themselves.
"""

from collections import deque

from django.db import connection
from django.db.models import Q

from board.models import (
    FinancialPeriod,
    KnowledgeGraphEdge,
    KnowledgeGraphNode,
    VectorDocumentChunk,
)

from .commentary import _outlook_summary
from .embeddings import embed_text


def _cosine_distance(a: list[float], b: list[float]) -> float:
    """Plain cosine distance (1 - similarity) for the SQLite fallback path."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 1.0
    return 1.0 - dot / (norm_a * norm_b)


def _nearest_chunks(period: FinancialPeriod, query_vector: list[float], top_k: int) -> list[VectorDocumentChunk]:
    """
    Top-k chunks by cosine distance, scoped to this period plus
    period-null global documents (rulebooks/criteria docs, which apply
    to every period by nature). Never returns another period's chunks.
    """
    scoped = VectorDocumentChunk.objects.filter(Q(period=period) | Q(period__isnull=True))

    if connection.vendor == "postgresql":
        from pgvector.django import CosineDistance

        return list(
            scoped.annotate(distance=CosineDistance("embedding", query_vector)).order_by("distance")[:top_k]
        )

    # SQLite (dev/test) fallback: brute-force over the scoped set. Fine
    # at dev scale; production always takes the HNSW-indexed path above.
    scored = [(_cosine_distance(list(chunk.embedding), query_vector), chunk) for chunk in scoped]
    scored.sort(key=lambda pair: pair[0])
    return [chunk for _distance, chunk in scored[:top_k]]


def _seed_nodes(retrieved_chunks: list[VectorDocumentChunk], user_query: str) -> list[KnowledgeGraphNode]:
    """
    Traversal entry points: nodes whose provenance chunk was just
    retrieved, plus nodes literally named in the query. The graph table
    is small and human-curated, so the name scan is cheap.
    """
    seeds = {node.pk: node for node in KnowledgeGraphNode.objects.filter(source_chunk__in=retrieved_chunks)}
    query_lower = user_query.lower()
    for node in KnowledgeGraphNode.objects.all():
        if node.name.lower() in query_lower:
            seeds[node.pk] = node
    return list(seeds.values())


def _traverse_graph(seeds: list[KnowledgeGraphNode], graph_depth: int) -> list[dict]:
    """
    BFS over edges in both directions, up to `graph_depth` hops from
    the seed set. Triples are always recorded in their stored direction
    regardless of which way the walk crossed them. Visited-sets on both
    nodes and edges keep cycles from looping or duplicating triples.
    """
    triples = []
    seen_edges: set[int] = set()
    visited: set[int] = {node.pk for node in seeds}
    frontier = deque((node.pk, 0) for node in seeds)

    while frontier:
        node_pk, depth = frontier.popleft()
        if depth >= graph_depth:
            continue
        edges = KnowledgeGraphEdge.objects.filter(Q(source_id=node_pk) | Q(target_id=node_pk)).select_related(
            "source", "target"
        )
        for edge in edges:
            if edge.pk not in seen_edges:
                seen_edges.add(edge.pk)
                triples.append(
                    {
                        "source": edge.source.name,
                        "edge_type": edge.edge_type,
                        "target": edge.target.name,
                        "metadata": edge.metadata,
                    }
                )
            neighbor_pk = edge.target_id if edge.source_id == node_pk else edge.source_id
            if neighbor_pk not in visited:
                visited.add(neighbor_pk)
                frontier.append((neighbor_pk, depth + 1))

    return triples


def _format_context(period_label: str, figures: dict, chunks: list[VectorDocumentChunk], triples: list[dict], user_query: str) -> str:
    lines = [f"VERIFIED FINANCIAL FIGURES ({period_label}):"]
    if figures:
        lines += [f"  {key}: {value}" for key, value in figures.items()]
    else:
        lines.append("  (no validated figures available for this period)")

    lines.append("")
    lines.append("RETRIEVED SOURCE EXCERPTS:")
    if chunks:
        for chunk in chunks:
            page = f" p.{chunk.page_number}" if chunk.page_number is not None else ""
            lines.append(f"  [{chunk.source_document}{page}]")
            lines.append(f"  {chunk.text.strip()}")
            lines.append("")
    else:
        lines.append("  (no source documents ingested yet)")
        lines.append("")

    lines.append("REGULATORY KNOWLEDGE GRAPH:")
    if triples:
        for triple in triples:
            metadata = f"  // {triple['metadata']}" if triple["metadata"] else ""
            lines.append(f"  {triple['source']} -[{triple['edge_type']}]-> {triple['target']}{metadata}")
    else:
        lines.append("  (no graph relationships recorded yet)")

    lines.append("")
    lines.append(f"USER QUESTION: {user_query}")
    return "\n".join(lines)


def execute_hybrid_rag_query(period_label: str, user_query: str, top_k: int = 5, graph_depth: int = 2) -> dict:
    """
    Returns {"context": str, "figures": dict, "chunks": [...],
    "graph_triples": [...]}. `context` is ready to hand to Gemini's
    generate_content as grounding; the structured parts are returned
    alongside so a caller can render citations without re-parsing.

    Raises FinancialPeriod.DoesNotExist for an unknown label and
    RuntimeError if the query embedding fails (embeddings.embed_text's
    wrapped error) — callers surface both as 400s, not 500s.
    """
    period = FinancialPeriod.objects.get(label=period_label)

    figures = _outlook_summary(period) or {}

    query_vector = embed_text(user_query, task_type="RETRIEVAL_QUERY")
    chunks = _nearest_chunks(period, query_vector, top_k)

    triples = _traverse_graph(_seed_nodes(chunks, user_query), graph_depth)

    return {
        "context": _format_context(period.label, figures, chunks, triples, user_query),
        "figures": figures,
        "chunks": [
            {
                "source_document": chunk.source_document,
                "page_number": chunk.page_number,
                "chunk_index": chunk.chunk_index,
                "text": chunk.text,
            }
            for chunk in chunks
        ],
        "graph_triples": triples,
    }
