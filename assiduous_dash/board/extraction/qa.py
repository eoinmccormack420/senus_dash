"""
"Ask the Data" — grounded Q&A over the hybrid RAG layer.

Save as: board/extraction/qa.py

This is the generation half that retrieval.py deliberately doesn't do:
retrieval (execute_hybrid_rag_query) and generation stay separate calls
with separate inputs so a retrieval failure and a generation failure
can never be conflated — the same isolation rule that keeps extraction
and commentary separate (README §1).

Every answered question is persisted as a BoardQuestion audit row with
snapshots of exactly what grounded the answer.
"""

import time
from decimal import Decimal
from typing import Optional

from google.genai import types

from board.models import BoardQuestion, FinancialPeriod

from .gemini_client import GEMINI_MODEL, _get_client
from .retrieval import execute_hybrid_rag_query

ANSWER_PREAMBLE = """You are the AI analyst for Senus PLC's board reporting platform.
Answer the board member's question using ONLY the context below.

Rules:
- Ground every claim in the context, but do NOT cite sources inline and
  do NOT use bracketed labels like [source p.N] anywhere in your answer.
  The source documents are already shown to the reader separately, so
  citation markers in the text are redundant.
- Use the VERIFIED FINANCIAL FIGURES for any numbers — never invent or
  estimate figures that aren't in the context.
- If the context does not contain enough information to answer, say so
  plainly and state what additional data or documents would be needed.
- Be concise and board-appropriate: short paragraphs, no filler.

Output format — plain text with only these structural markers, no other markdown:
- Start a section heading line with "# " (e.g. "# Cash Position").
- Start a subheading line with "## " (e.g. "## Short-term liquidity").
- Use headings/subheadings only where they genuinely help organize a
  longer answer — a short answer needs none.
- Do NOT use *, **, _, or ` for emphasis or code formatting anywhere.
- Do NOT use markdown links or images.
- For lists, start each line with "- " and nothing else (no numbering,
  no bold labels).
- Separate paragraphs with a single blank line.
- Write in plain sentences and short paragraphs only.

"""


def _json_safe(value):
    """
    _outlook_summary's figures carry Decimals (straight off the model
    fields), which json.dumps — and therefore JSONField — rejects.
    Floats are fine for an audit snapshot; the authoritative values
    stay in the statement tables.
    """
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


def generate_grounded_answer(context: str, max_retries: int = 2) -> str:
    """
    One Gemini generation call over the assembled RAG context. Retries
    with backoff and re-raises a wrapped RuntimeError after exhausting
    attempts — the caller (answer_board_question / the view) records or
    reports it rather than letting it propagate as a 500.
    """
    client = _get_client()
    prompt = ANSWER_PREAMBLE + context

    last_error: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.2),
            )
            answer = (response.text or "").strip()
            if not answer:
                raise ValueError("Gemini returned an empty answer")
            return answer
        except Exception as exc:  # noqa: BLE001 - wrapped and re-raised below, house convention
            last_error = exc
            if attempt < max_retries:
                time.sleep(2 ** (attempt + 1))
                continue
            raise RuntimeError(
                f"Gemini grounded-answer generation failed after {max_retries + 1} attempt(s): {last_error}"
            ) from last_error


def answer_board_question(period_label: str, question: str, user=None) -> BoardQuestion:
    """
    Full ask flow: hybrid retrieval -> grounded generation -> audit row.

    Raises FinancialPeriod.DoesNotExist for an unknown label and
    RuntimeError for an embedding/generation failure — the view maps
    both to 400s.
    """
    result = execute_hybrid_rag_query(period_label, question)
    answer = generate_grounded_answer(result["context"])

    period = FinancialPeriod.objects.get(label=period_label)
    return BoardQuestion.objects.create(
        period=period,
        asked_by=user if getattr(user, "is_authenticated", False) else None,
        question=question,
        answer=answer,
        context_chunks=_json_safe(result["chunks"]),
        figures_snapshot=_json_safe(result["figures"]),
        graph_triples=_json_safe(result["graph_triples"]),
        model_used=GEMINI_MODEL,
    )
