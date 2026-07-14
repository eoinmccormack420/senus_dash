"""
Tests for "Ask the Data": qa.py's grounded-answer generation
(retry/wrap) and answer_board_question's persistence, plus
AskBoardQuestionView/BoardQuestionHistoryView auth gating and
error-as-400 behavior. Gemini and retrieval are mocked at their import
sites (board.extraction.qa._get_client / .execute_hybrid_rag_query,
board.views.answer_board_question), same convention as every other
test file here.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from board.extraction.qa import answer_board_question, generate_grounded_answer
from board.models import BoardQuestion, FinancialPeriod


def make_period(label="HY2026", **kwargs):
    defaults = dict(period_type="half_year", start_date=date(2025, 7, 1), end_date=date(2025, 12, 31))
    defaults.update(kwargs)
    return FinancialPeriod.objects.create(label=label, **defaults)


FAKE_RAG_RESULT = {
    "context": "VERIFIED FINANCIAL FIGURES (HY2026):\n  revenue: 354813\nUSER QUESTION: outlook?",
    "figures": {"revenue": Decimal("354813.00"), "verified": False},
    "chunks": [{"source_document": "HY Results PR", "page_number": 3, "chunk_index": 6, "text": "Outlook strong."}],
    "graph_triples": [{"source": "Rule 2.1", "edge_type": "REQUIRES", "target": "Audit", "metadata": {}}],
}


class TestGenerateGroundedAnswer:
    def test_returns_answer_text(self, monkeypatch):
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = MagicMock(text="The outlook is confident. [HY Results PR p.3]")
        monkeypatch.setattr("board.extraction.qa._get_client", lambda: mock_client)

        answer = generate_grounded_answer("some context")

        assert "confident" in answer
        prompt = mock_client.models.generate_content.call_args.kwargs["contents"]
        assert "ONLY the context" in prompt
        assert "some context" in prompt

    def test_retries_then_succeeds(self, monkeypatch):
        monkeypatch.setattr("board.extraction.qa.time.sleep", lambda _: None)
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = [
            OSError("503 UNAVAILABLE"),
            MagicMock(text="answer"),
        ]
        monkeypatch.setattr("board.extraction.qa._get_client", lambda: mock_client)

        assert generate_grounded_answer("ctx") == "answer"
        assert mock_client.models.generate_content.call_count == 2

    def test_wraps_error_after_exhausting_retries(self, monkeypatch):
        monkeypatch.setattr("board.extraction.qa.time.sleep", lambda _: None)
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = OSError("overloaded")
        monkeypatch.setattr("board.extraction.qa._get_client", lambda: mock_client)

        with pytest.raises(RuntimeError, match="grounded-answer generation failed"):
            generate_grounded_answer("ctx", max_retries=1)

    def test_empty_answer_is_retried(self, monkeypatch):
        monkeypatch.setattr("board.extraction.qa.time.sleep", lambda _: None)
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = [
            MagicMock(text=""),
            MagicMock(text="real answer"),
        ]
        monkeypatch.setattr("board.extraction.qa._get_client", lambda: mock_client)

        assert generate_grounded_answer("ctx") == "real answer"


@pytest.mark.django_db
class TestAnswerBoardQuestion:
    def test_persists_answer_with_snapshots(self, monkeypatch):
        period = make_period()
        user = User.objects.create_user(username="board-member", password="pw")
        monkeypatch.setattr("board.extraction.qa.execute_hybrid_rag_query", lambda label, q: FAKE_RAG_RESULT)
        monkeypatch.setattr("board.extraction.qa.generate_grounded_answer", lambda ctx: "Grounded answer. [HY Results PR p.3]")

        row = answer_board_question("HY2026", "What is the outlook?", user=user)

        assert row.pk is not None
        assert row.period == period
        assert row.asked_by == user
        assert row.answer.startswith("Grounded answer")
        assert row.context_chunks[0]["source_document"] == "HY Results PR"
        # Decimals sanitized for JSONField storage
        assert row.figures_snapshot["revenue"] == 354813.0
        assert row.figures_snapshot["verified"] is False
        assert row.graph_triples[0]["edge_type"] == "REQUIRES"

    def test_unknown_period_raises_does_not_exist(self, monkeypatch):
        def raise_missing(label, q):
            raise FinancialPeriod.DoesNotExist

        monkeypatch.setattr("board.extraction.qa.execute_hybrid_rag_query", raise_missing)

        with pytest.raises(FinancialPeriod.DoesNotExist):
            answer_board_question("NOPE", "anything")

        assert BoardQuestion.objects.count() == 0

    def test_generation_failure_persists_nothing(self, monkeypatch):
        make_period()
        monkeypatch.setattr("board.extraction.qa.execute_hybrid_rag_query", lambda label, q: FAKE_RAG_RESULT)

        def boom(ctx):
            raise RuntimeError("Gemini grounded-answer generation failed after 3 attempt(s): boom")

        monkeypatch.setattr("board.extraction.qa.generate_grounded_answer", boom)

        with pytest.raises(RuntimeError):
            answer_board_question("HY2026", "anything")

        assert BoardQuestion.objects.count() == 0


@pytest.mark.django_db
class TestAskBoardQuestionView:
    def test_requires_authentication(self):
        response = APIClient().post("/api/ask/", {"question": "x"}, format="json")

        assert response.status_code == 401

    def test_any_authenticated_user_can_ask(self):
        period = make_period()
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)
        fake_row = BoardQuestion.objects.create(
            period=period, asked_by=user, question="outlook?", answer="Confident.", model_used="gemini-2.5-flash"
        )

        with patch("board.views.answer_board_question", return_value=fake_row) as mock_answer:
            response = client.post("/api/ask/", {"question": "outlook?", "period": "HY2026"}, format="json")

        assert response.status_code == 200
        assert response.data["answer"] == "Confident."
        assert response.data["asked_by"] == "regular"
        mock_answer.assert_called_once_with("HY2026", "outlook?", user=user)

    def test_defaults_to_latest_period(self):
        make_period(label="OLD", start_date=date(2024, 1, 1), end_date=date(2024, 6, 30))
        newest = make_period(label="NEWEST")
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)
        fake_row = BoardQuestion.objects.create(period=newest, question="q", answer="a")

        with patch("board.views.answer_board_question", return_value=fake_row) as mock_answer:
            response = client.post("/api/ask/", {"question": "q"}, format="json")

        assert response.status_code == 200
        assert mock_answer.call_args.args[0] == "NEWEST"

    def test_missing_question_is_400(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post("/api/ask/", {"question": "  "}, format="json")

        assert response.status_code == 400

    def test_gemini_failure_reported_as_400(self):
        make_period()
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        with patch("board.views.answer_board_question", side_effect=RuntimeError("Gemini failed")):
            response = client.post("/api/ask/", {"question": "q", "period": "HY2026"}, format="json")

        assert response.status_code == 400
        assert "Gemini failed" in response.data["detail"]

    def test_unknown_period_reported_as_400(self):
        make_period()
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        with patch("board.views.answer_board_question", side_effect=FinancialPeriod.DoesNotExist):
            response = client.post("/api/ask/", {"question": "q", "period": "NOPE"}, format="json")

        assert response.status_code == 400


@pytest.mark.django_db
class TestBoardQuestionHistoryView:
    def test_requires_authentication(self):
        response = APIClient().get("/api/ask/history/")

        assert response.status_code == 401

    def test_returns_newest_first_capped_at_twenty(self):
        period = make_period()
        for i in range(25):
            BoardQuestion.objects.create(period=period, question=f"q{i}", answer=f"a{i}")
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/ask/history/")

        assert response.status_code == 200
        assert len(response.data) == 20
        assert response.data[0]["question"] == "q24"  # newest first
