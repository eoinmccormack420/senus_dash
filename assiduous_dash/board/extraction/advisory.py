"""
Strategic Advisory Agent — suggests SMART funding-readiness goals using
Gemini, from the ALREADY-VALIDATED structured data in the database.

Save as: board/extraction/advisory.py

This is the third Gemini-backed pipeline (alongside gemini_client.py's
extraction and commentary.py's narrative generation), kept separate for
the same reason as the other two: it reads validated DB figures, never
a raw document, so an advisory-suggestion error and an extraction error
can never be conflated. It reuses commentary.py's outlook summary
builder (_outlook_summary) rather than building its own — that summary
already aggregates the cross-statement ratios and provenance data most
relevant to "is this company investor-ready," so goal suggestions are
grounded in the same figures the board's own Executive Summary is.
"""

import json
import time
from typing import Optional

from .commentary import _hash_summaries, _outlook_summary
from .gemini_client import GEMINI_MODEL, _get_client
from google.genai import types

from board.models import AdvisoryGoal

REQUIRED_GOAL_KEYS = {"title", "description", "rationale"}


def build_advisory_prompt(period_label: str, figures: dict) -> str:
    figures_str = "\n".join(f"  {k}: {v}" for k, v in figures.items())
    return f"""You are an AI-native corporate finance advisor for an Irish SME
preparing for future investor engagement or a Euronext Growth listing.
Based on the company's {period_label} financial fundamentals below,
identify exactly three SMART goals (Specific, Measurable, Achievable,
Relevant, Time-bound) for the next 12 months that would make this
company more attractive to investors.

Rules:
- Reference SPECIFIC figures from the data below where relevant,
  formatted as €X or X%. Do not invent figures not present in the data.
- Each goal must be genuinely achievable from the company's current
  position — do not suggest generic goals disconnected from the actual
  figures below.
- Return ONLY a JSON array of exactly 3 objects, each with keys
  "title" (a short goal name, under 80 characters), "description" (the
  full SMART goal, 2-3 sentences), and "rationale" (1-2 sentences on
  why this matters for investor readiness). No other text.

{period_label} figures:
{figures_str}

JSON:"""


def generate_strategic_goals(period, max_retries: int = 2) -> list[dict]:
    """
    Calls Gemini in JSON mode and returns exactly 3 goal dicts. Retries
    with backoff on failure or a malformed response — same
    retry-then-wrap-RuntimeError shape as commentary.generate_commentary,
    just with an added validation step since (unlike prose commentary)
    a malformed JSON response here can't be used at all.
    """
    client = _get_client()
    summary = _outlook_summary(period)
    prompt = build_advisory_prompt(period.label, summary)

    last_error: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json", temperature=0.4
                ),
            )
            goals = json.loads(response.text)
            if not isinstance(goals, list) or len(goals) != 3:
                raise ValueError(f"Expected exactly 3 goals, got: {goals!r}")
            for goal in goals:
                if not REQUIRED_GOAL_KEYS.issubset(goal):
                    raise ValueError(f"Goal missing required keys: {goal!r}")
            return goals
        except Exception as exc:  # noqa: BLE001 - caught upstream in generate_goals_for_period
            last_error = exc
            if attempt < max_retries:
                time.sleep(2 ** (attempt + 1))
                continue
            raise RuntimeError(
                f"Gemini strategic goal generation failed for {period.label} "
                f"after {max_retries + 1} attempt(s): {last_error}"
            ) from last_error


def generate_goals_for_period(period, force: bool = False) -> dict:
    """
    Generates (or reuses cached) suggested goals for `period`. Returns
    {"status": "generated"|"skipped"|"error", "detail": ...}.

    Caching mirrors generate_insights_for_period: the exact figures
    handed to the prompt are hashed and compared against the period's
    existing "suggested" goals before calling Gemini again. Committed,
    completed, and dismissed goals are never touched by a regenerate —
    only the still-"suggested" rows are replaced, since a human hasn't
    acted on those yet.
    """
    summary = _outlook_summary(period)
    if not summary:
        return {"status": "skipped", "detail": f"no data for {period.label}"}

    data_hash = _hash_summaries(summary, None)

    existing_suggested = list(AdvisoryGoal.objects.filter(period=period, status="suggested"))
    if existing_suggested and all(g.source_data_hash == data_hash for g in existing_suggested) and not force:
        return {"status": "skipped", "detail": "source figures unchanged, cached goals reused"}

    try:
        goals = generate_strategic_goals(period)
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "detail": str(exc)}

    AdvisoryGoal.objects.filter(period=period, status="suggested").delete()
    for i, goal in enumerate(goals, start=1):
        AdvisoryGoal.objects.create(
            period=period,
            order=i,
            title=goal["title"],
            description=goal["description"],
            rationale=goal["rationale"],
            model_used=GEMINI_MODEL,
            source_data_hash=data_hash,
        )

    return {"status": "generated", "detail": f"{len(goals)} goals suggested"}
