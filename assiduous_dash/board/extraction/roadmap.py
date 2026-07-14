"""
Funding Readiness Roadmap — generates an ordered, time-sequenced set of
phases toward investor readiness using Gemini, from the
ALREADY-VALIDATED structured data in the database.

Save as: board/extraction/roadmap.py

This is a fourth Gemini-backed pipeline (alongside gemini_client.py's
extraction, commentary.py's narrative generation, and advisory.py's
Strategic Advisory Agent), kept separate for the same reason as the
others: it reads validated DB figures, never a raw document. It reuses
commentary.py's outlook summary builder (_outlook_summary) — the same
one advisory.py already reuses — so the roadmap is grounded in the
same figures the board's own Executive Summary and suggested goals are.

Unlike advisory.py's independent goals, this asks for a SEQUENCE: each
phase builds on the prior one, giving the board a genuine "path to
readiness" rather than an unordered list.
"""

import json
import time
from typing import Optional

from .commentary import _hash_summaries, _outlook_summary
from .gemini_client import GEMINI_MODEL, _get_client
from google.genai import types

from board.models import FundingRoadmapStep

REQUIRED_STEP_KEYS = {"timeframe", "title", "description"}
ROADMAP_STEP_COUNT = 4


def build_roadmap_prompt(period_label: str, figures: dict) -> str:
    figures_str = "\n".join(f"  {k}: {v}" for k, v in figures.items())
    return f"""You are an AI-native corporate finance advisor for an Irish SME
preparing for future investor engagement or a Euronext Growth listing.
Based on the company's {period_label} financial fundamentals below,
lay out a funding-readiness roadmap of exactly four sequential phases
spanning the next 12 months, each phase building on the one before it.

Rules:
- Reference SPECIFIC figures from the data below where relevant,
  formatted as €X or X%. Do not invent figures not present in the data.
- Each phase must be genuinely achievable from the company's current
  position and from the phase before it — do not suggest generic steps
  disconnected from the actual figures below.
- Return ONLY a JSON array of exactly 4 objects, in chronological
  order, each with keys "timeframe" (a short label, e.g. "Months 1-3"),
  "title" (a short phase name, under 80 characters), and "description"
  (2-3 sentences on what happens in this phase and why). No other text.

{period_label} figures:
{figures_str}

JSON:"""


def generate_funding_roadmap(period, max_retries: int = 2) -> list[dict]:
    """
    Calls Gemini in JSON mode and returns exactly 4 sequential phase
    dicts. Retries with backoff on failure or a malformed response —
    same retry-then-wrap-RuntimeError shape as
    advisory.generate_strategic_goals.
    """
    client = _get_client()
    summary = _outlook_summary(period)
    prompt = build_roadmap_prompt(period.label, summary)

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
            steps = json.loads(response.text)
            if not isinstance(steps, list) or len(steps) != ROADMAP_STEP_COUNT:
                raise ValueError(f"Expected exactly {ROADMAP_STEP_COUNT} steps, got: {steps!r}")
            for step in steps:
                if not REQUIRED_STEP_KEYS.issubset(step):
                    raise ValueError(f"Step missing required keys: {step!r}")
            return steps
        except Exception as exc:  # noqa: BLE001 - caught upstream in generate_roadmap_for_period
            last_error = exc
            if attempt < max_retries:
                time.sleep(2 ** (attempt + 1))
                continue
            raise RuntimeError(
                f"Gemini funding roadmap generation failed for {period.label} "
                f"after {max_retries + 1} attempt(s): {last_error}"
            ) from last_error


def generate_roadmap_for_period(period, force: bool = False) -> dict:
    """
    Generates (or reuses cached) roadmap steps for `period`. Returns
    {"status": "generated"|"skipped"|"error", "detail": ...}.

    Caching mirrors generate_goals_for_period: the exact figures handed
    to the prompt are hashed and compared against the period's existing
    steps before calling Gemini again. Unlike AdvisoryGoal, there's no
    commit/dismiss workflow — the whole set is replaced wholesale on
    every regeneration, since these are purely advisory narrative, not
    something a human individually acts on.
    """
    summary = _outlook_summary(period)
    if not summary:
        return {"status": "skipped", "detail": f"no data for {period.label}"}

    data_hash = _hash_summaries(summary, None)

    existing_steps = list(FundingRoadmapStep.objects.filter(period=period))
    if existing_steps and all(s.source_data_hash == data_hash for s in existing_steps) and not force:
        return {"status": "skipped", "detail": "source figures unchanged, cached roadmap reused"}

    try:
        steps = generate_funding_roadmap(period)
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "detail": str(exc)}

    FundingRoadmapStep.objects.filter(period=period).delete()
    for i, step in enumerate(steps, start=1):
        FundingRoadmapStep.objects.create(
            period=period,
            order=i,
            timeframe=step["timeframe"],
            title=step["title"],
            description=step["description"],
            model_used=GEMINI_MODEL,
            source_data_hash=data_hash,
        )

    return {"status": "generated", "detail": f"{len(steps)} roadmap steps generated"}
