"""
Tests for the hybrid Vector + Graph RAG layer: embeddings.embed_text's
retry/normalize/wrap contract, retrieval's nearest-chunk scoping (the
isolation contract) and graph traversal bounds, the assembled context
block, and the ingest_knowledge_document command's chunk/replace
behavior. All Gemini calls are mocked (patch-where-used, same
convention as test_advisory_goals.py); these tests run on SQLite, so
they exercise exactly the brute-force fallback path retrieval uses off
Postgres.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from django.core.management import CommandError, call_command

from board.extraction.embeddings import EMBEDDING_DIMENSIONS, embed_text
from board.extraction.retrieval import (
    _nearest_chunks,
    _traverse_graph,
    execute_hybrid_rag_query,
)
from board.management.commands.ingest_knowledge_document import chunk_page_text
from board.models import (
    BalanceSheet,
    CashFlow,
    FinancialPeriod,
    KnowledgeGraphEdge,
    KnowledgeGraphNode,
    PLStatement,
    VectorDocumentChunk,
)


def make_vector(*leading: float) -> list[float]:
    """A 1536-dim vector with the given leading components, zero-padded."""
    values = list(leading) + [0.0] * (EMBEDDING_DIMENSIONS - len(leading))
    return values


def make_period(label="TEST", **kwargs):
    defaults = dict(period_type="half_year", start_date=date(2025, 1, 1), end_date=date(2025, 6, 30))
    defaults.update(kwargs)
    return FinancialPeriod.objects.create(label=label, **defaults)


def make_full_period(label="TEST"):
    period = make_period(label=label)
    PLStatement.objects.create(
        period=period,
        revenue=Decimal("100000"),
        cost_of_sales=Decimal("20000"),
        admin_expenses=Decimal("30000"),
        gross_profit=Decimal("80000"),
        operating_loss=Decimal("-10000"),
        loss_before_tax=Decimal("-10000"),
        loss_after_tax=Decimal("-10000"),
    )
    BalanceSheet.objects.create(
        period=period,
        tangible_assets=Decimal("50000"),
        debtors=Decimal("10000"),
        cash=Decimal("20000"),
        current_creditors=Decimal("-15000"),
        share_capital=Decimal("1000"),
        retained_earnings=Decimal("-5000"),
    )
    CashFlow.objects.create(
        period=period,
        net_operating_cash=Decimal("-5000"),
        net_financing_cash=Decimal("2000"),
        net_cash_movement=Decimal("-3000"),
        opening_cash=Decimal("23000"),
        closing_cash=Decimal("20000"),
    )
    return period


def make_chunk(source_document, chunk_index, embedding, period=None, text="clause text", page_number=1):
    return VectorDocumentChunk.objects.create(
        period=period,
        source_document=source_document,
        chunk_index=chunk_index,
        text=text,
        embedding=embedding,
        page_number=page_number,
    )


class TestEmbedText:
    def test_normalizes_to_unit_length(self, monkeypatch):
        raw = make_vector(3.0, 4.0)  # norm 5 — comes back scaled to 1
        mock_client = MagicMock()
        mock_client.models.embed_content.return_value = MagicMock(embeddings=[MagicMock(values=raw)])
        monkeypatch.setattr("board.extraction.embeddings._get_client", lambda: mock_client)

        vector = embed_text("some text")

        assert len(vector) == EMBEDDING_DIMENSIONS
        assert abs(sum(v * v for v in vector) - 1.0) < 1e-9
        assert abs(vector[0] - 0.6) < 1e-9
        assert abs(vector[1] - 0.8) < 1e-9

    def test_retries_then_succeeds(self, monkeypatch):
        monkeypatch.setattr("board.extraction.embeddings.time.sleep", lambda _: None)
        mock_client = MagicMock()
        mock_client.models.embed_content.side_effect = [
            OSError("503 UNAVAILABLE"),
            MagicMock(embeddings=[MagicMock(values=make_vector(1.0))]),
        ]
        monkeypatch.setattr("board.extraction.embeddings._get_client", lambda: mock_client)

        vector = embed_text("some text")

        assert vector[0] == 1.0
        assert mock_client.models.embed_content.call_count == 2

    def test_wraps_error_after_exhausting_retries(self, monkeypatch):
        monkeypatch.setattr("board.extraction.embeddings.time.sleep", lambda _: None)
        mock_client = MagicMock()
        mock_client.models.embed_content.side_effect = OSError("model overloaded")
        monkeypatch.setattr("board.extraction.embeddings._get_client", lambda: mock_client)

        with pytest.raises(RuntimeError, match="Gemini embedding failed"):
            embed_text("some text", max_retries=1)

        assert mock_client.models.embed_content.call_count == 2

    def test_rejects_wrong_dimensionality(self, monkeypatch):
        monkeypatch.setattr("board.extraction.embeddings.time.sleep", lambda _: None)
        mock_client = MagicMock()
        mock_client.models.embed_content.return_value = MagicMock(embeddings=[MagicMock(values=[1.0, 2.0])])
        monkeypatch.setattr("board.extraction.embeddings._get_client", lambda: mock_client)

        with pytest.raises(RuntimeError, match="Expected 1536-dim"):
            embed_text("some text", max_retries=0)


@pytest.mark.django_db
class TestNearestChunks:
    def test_orders_by_cosine_distance(self):
        period = make_period()
        far = make_chunk("doc", 0, make_vector(0.0, 1.0), period=period)
        near = make_chunk("doc", 1, make_vector(1.0, 0.0), period=period)
        middle = make_chunk("doc", 2, make_vector(1.0, 1.0), period=period)

        results = _nearest_chunks(period, make_vector(1.0, 0.0), top_k=3)

        assert [c.pk for c in results] == [near.pk, middle.pk, far.pk]

    def test_never_returns_another_periods_chunks(self):
        period = make_period(label="MINE")
        other = make_period(label="OTHER", start_date=date(2024, 1, 1), end_date=date(2024, 6, 30))
        mine = make_chunk("mine-doc", 0, make_vector(1.0), period=period)
        make_chunk("other-doc", 0, make_vector(1.0), period=other)  # identical embedding, wrong period

        results = _nearest_chunks(period, make_vector(1.0), top_k=10)

        assert [c.pk for c in results] == [mine.pk]

    def test_includes_global_period_null_chunks(self):
        period = make_period()
        rulebook = make_chunk("rulebook", 0, make_vector(1.0), period=None)

        results = _nearest_chunks(period, make_vector(1.0), top_k=10)

        assert [c.pk for c in results] == [rulebook.pk]

    def test_respects_top_k(self):
        period = make_period()
        for i in range(5):
            make_chunk("doc", i, make_vector(1.0, float(i)), period=period)

        results = _nearest_chunks(period, make_vector(1.0), top_k=2)

        assert len(results) == 2


@pytest.mark.django_db
class TestTraverseGraph:
    def _node(self, name, node_type="euronext_rule"):
        return KnowledgeGraphNode.objects.create(node_type=node_type, name=name)

    def test_collects_triples_within_depth(self):
        a, b, c, d = self._node("A"), self._node("B"), self._node("C"), self._node("D")
        KnowledgeGraphEdge.objects.create(source=a, target=b, edge_type="REQUIRES")
        KnowledgeGraphEdge.objects.create(source=b, target=c, edge_type="REQUIRES")
        KnowledgeGraphEdge.objects.create(source=c, target=d, edge_type="REQUIRES")

        triples = _traverse_graph([a], graph_depth=2)

        pairs = {(t["source"], t["target"]) for t in triples}
        assert ("A", "B") in pairs
        assert ("B", "C") in pairs
        assert ("C", "D") not in pairs  # third hop, beyond depth 2

    def test_cycle_does_not_loop_or_duplicate(self):
        a, b = self._node("A"), self._node("B")
        KnowledgeGraphEdge.objects.create(source=a, target=b, edge_type="RELATED_TO")
        KnowledgeGraphEdge.objects.create(source=b, target=a, edge_type="RELATED_TO")

        triples = _traverse_graph([a], graph_depth=5)

        assert len(triples) == 2

    def test_traverses_incoming_edges_too(self):
        parent, child = self._node("Parent", "subsidiary"), self._node("Child", "subsidiary")
        KnowledgeGraphEdge.objects.create(source=parent, target=child, edge_type="PARENT_OF")

        triples = _traverse_graph([child], graph_depth=1)

        assert triples[0]["source"] == "Parent"
        assert triples[0]["edge_type"] == "PARENT_OF"


@pytest.mark.django_db
class TestExecuteHybridRagQuery:
    def test_assembles_all_three_sections(self, monkeypatch):
        period = make_full_period(label="HY2026")
        chunk = make_chunk(
            "Euronext Rule Book", 0, make_vector(1.0), period=None,
            text="Rule 2.1: issuers must have three years of audited accounts.", page_number=14,
        )
        rule = KnowledgeGraphNode.objects.create(
            node_type="euronext_rule", name="Rule 2.1", source_chunk=chunk
        )
        requirement = KnowledgeGraphNode.objects.create(node_type="requirement", name="3 Audited Years")
        KnowledgeGraphEdge.objects.create(source=rule, target=requirement, edge_type="REQUIRES_AUDIT_YEARS")

        monkeypatch.setattr("board.extraction.retrieval.embed_text", lambda text, task_type: make_vector(1.0))

        result = execute_hybrid_rag_query("HY2026", "Are we ready for a Euronext listing?")

        context = result["context"]
        assert "VERIFIED FINANCIAL FIGURES (HY2026):" in context
        assert "RETRIEVED SOURCE EXCERPTS:" in context
        assert "[Euronext Rule Book p.14]" in context
        assert "three years of audited accounts" in context
        assert "REGULATORY KNOWLEDGE GRAPH:" in context
        assert "Rule 2.1 -[REQUIRES_AUDIT_YEARS]-> 3 Audited Years" in context
        assert "USER QUESTION: Are we ready for a Euronext listing?" in context
        assert result["figures"]  # deterministic figures present
        assert result["chunks"][0]["source_document"] == "Euronext Rule Book"
        assert result["graph_triples"][0]["edge_type"] == "REQUIRES_AUDIT_YEARS"

    def test_query_named_node_seeds_traversal_without_chunk_link(self, monkeypatch):
        make_full_period(label="HY2026")
        hpsu = KnowledgeGraphNode.objects.create(node_type="ei_benchmark", name="HPSU")
        ei = KnowledgeGraphNode.objects.create(node_type="regulator", name="Enterprise Ireland")
        KnowledgeGraphEdge.objects.create(source=ei, target=hpsu, edge_type="GOVERNED_BY")

        monkeypatch.setattr("board.extraction.retrieval.embed_text", lambda text, task_type: make_vector(1.0))

        result = execute_hybrid_rag_query("HY2026", "Do we meet the HPSU criteria?")

        assert any(t["target"] == "HPSU" for t in result["graph_triples"])

    def test_unknown_period_raises(self, monkeypatch):
        monkeypatch.setattr("board.extraction.retrieval.embed_text", lambda text, task_type: make_vector(1.0))

        with pytest.raises(FinancialPeriod.DoesNotExist):
            execute_hybrid_rag_query("NOPE", "anything")


class TestChunkPageText:
    def test_overlapping_chunks_cover_full_text(self):
        text = "x" * 4000

        chunks = chunk_page_text(text, chunk_size=1500, overlap=200)

        assert len(chunks) == 3
        assert all(len(c) <= 1500 for c in chunks)

    def test_short_text_is_one_chunk(self):
        assert chunk_page_text("short clause") == ["short clause"]

    def test_whitespace_only_produces_nothing(self):
        assert chunk_page_text("   \n  ") == []


@pytest.mark.django_db
class TestIngestCommand:
    def _fake_pdf(self, pages: list[str]):
        fake = MagicMock()
        fake.pages = [MagicMock(extract_text=MagicMock(return_value=p)) for p in pages]
        fake.__enter__ = MagicMock(return_value=fake)
        fake.__exit__ = MagicMock(return_value=False)
        return fake

    def test_ingests_chunks_with_page_numbers(self):
        with patch(
            "board.management.commands.ingest_knowledge_document.has_extractable_text", return_value=True
        ), patch(
            "board.management.commands.ingest_knowledge_document.pdfplumber.open",
            return_value=self._fake_pdf(["page one text", "page two text"]),
        ), patch(
            "board.management.commands.ingest_knowledge_document.embed_text",
            return_value=make_vector(1.0),
        ), patch(
            "board.management.commands.ingest_knowledge_document.time.sleep", lambda _: None
        ):
            call_command("ingest_knowledge_document", pdf="fake.pdf", source_name="Rulebook")

        chunks = list(VectorDocumentChunk.objects.order_by("chunk_index"))
        assert len(chunks) == 2
        assert chunks[0].page_number == 1
        assert chunks[1].page_number == 2
        assert chunks[0].period is None

    def test_reingest_replaces_wholesale(self):
        common = dict(pdf="fake.pdf", source_name="Rulebook")
        with patch(
            "board.management.commands.ingest_knowledge_document.has_extractable_text", return_value=True
        ), patch(
            "board.management.commands.ingest_knowledge_document.embed_text",
            return_value=make_vector(1.0),
        ), patch(
            "board.management.commands.ingest_knowledge_document.time.sleep", lambda _: None
        ):
            with patch(
                "board.management.commands.ingest_knowledge_document.pdfplumber.open",
                return_value=self._fake_pdf(["old text", "old more"]),
            ):
                call_command("ingest_knowledge_document", **common)
            with patch(
                "board.management.commands.ingest_knowledge_document.pdfplumber.open",
                return_value=self._fake_pdf(["new text"]),
            ):
                call_command("ingest_knowledge_document", **common)

        chunks = list(VectorDocumentChunk.objects.all())
        assert len(chunks) == 1
        assert chunks[0].text == "new text"

    def test_rejects_scanned_pdf(self):
        with patch(
            "board.management.commands.ingest_knowledge_document.has_extractable_text", return_value=False
        ):
            with pytest.raises(CommandError, match="no extractable text layer"):
                call_command("ingest_knowledge_document", pdf="scan.pdf", source_name="Scan")

    def test_rejects_unknown_period(self):
        with pytest.raises(CommandError, match="No period with label"):
            call_command("ingest_knowledge_document", pdf="fake.pdf", source_name="Doc", period="NOPE")
