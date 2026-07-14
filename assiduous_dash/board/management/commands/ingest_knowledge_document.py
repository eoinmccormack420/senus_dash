"""
Ingests a real source PDF (prospectus, Euronext rulebook, EI criteria
document) into VectorDocumentChunk rows for the hybrid RAG layer.

Save as: board/management/commands/ingest_knowledge_document.py

Usage:
    python manage.py ingest_knowledge_document --pdf path/to/rulebook.pdf \
        --source-name "Euronext Dublin Rule Book 2025" \
        [--period HY2026] [--kind pl_statement]

Omit --period for documents that aren't period-specific (rulebooks,
listing criteria) — those become "global" chunks retrieval includes for
every period. Re-ingesting the same --source-name replaces its chunks
wholesale (same convention as NearbyIncubator's refresh).

Reads text per page (pdfplumber directly, rather than
pdf_utils.extract_text_and_tables which collapses page boundaries)
because VectorDocumentChunk.page_number feeds the "[doc p.N]" citations
in retrieval's context block. Scanned PDFs with no text layer are
rejected up front with pdf_utils.has_extractable_text — the same
failure README §"Scanned PDFs" documents for extraction.
"""

import time

import pdfplumber
from django.core.management.base import BaseCommand, CommandError

from board.extraction.embeddings import EMBEDDING_MODEL, embed_text
from board.extraction.pdf_utils import has_extractable_text
from board.models import ExtractionAttempt, FinancialPeriod, VectorDocumentChunk

CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200

# Same rate-limit courtesy as drive_sync.GEMINI_CALL_DELAY_SECONDS,
# shorter because embedding calls are far cheaper than extractions.
EMBED_CALL_DELAY_SECONDS = 1

VALID_KINDS = [choice[0] for choice in ExtractionAttempt.STATEMENT_CHOICES]


def chunk_page_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Overlapping fixed-size chunks; overlap keeps a clause that straddles a boundary findable from either side."""
    chunks = []
    start = 0
    while start < len(text):
        chunk = text[start : start + chunk_size].strip()
        if chunk:
            chunks.append(chunk)
        if start + chunk_size >= len(text):
            break
        start += chunk_size - overlap
    return chunks


class Command(BaseCommand):
    help = "Embed a source PDF into VectorDocumentChunk rows for hybrid RAG retrieval."

    def add_arguments(self, parser):
        parser.add_argument("--pdf", required=True, help="Path to the source PDF.")
        parser.add_argument(
            "--source-name",
            required=True,
            help='Stable document identifier, e.g. "Euronext Dublin Rule Book 2025". Re-ingesting the same name replaces its chunks.',
        )
        parser.add_argument("--period", help="Optional FinancialPeriod label (e.g. HY2026) for period-specific documents.")
        parser.add_argument("--kind", choices=VALID_KINDS, help="Optional statement kind this document relates to.")

    def handle(self, *args, **options):
        pdf_path = options["pdf"]
        source_name = options["source_name"]

        period = None
        if options.get("period"):
            try:
                period = FinancialPeriod.objects.get(label=options["period"])
            except FinancialPeriod.DoesNotExist:
                raise CommandError(f"No period with label '{options['period']}'.")

        if not has_extractable_text(pdf_path):
            raise CommandError(
                f"{pdf_path} has no extractable text layer (scanned/photographed PDF) — "
                "OCR it or supply a digitally-generated copy before ingesting."
            )

        page_chunks: list[tuple[int, str]] = []
        with pdfplumber.open(pdf_path) as pdf:
            for page_number, page in enumerate(pdf.pages, start=1):
                page_text = page.extract_text() or ""
                for chunk_text in chunk_page_text(page_text):
                    page_chunks.append((page_number, chunk_text))

        if not page_chunks:
            raise CommandError(f"No text chunks produced from {pdf_path}.")

        self.stdout.write(f"Embedding {len(page_chunks)} chunk(s) from {len(set(p for p, _ in page_chunks))} page(s)...")

        rows = []
        for chunk_index, (page_number, chunk_text) in enumerate(page_chunks):
            embedding = embed_text(chunk_text, task_type="RETRIEVAL_DOCUMENT")
            rows.append(
                VectorDocumentChunk(
                    period=period,
                    statement_kind=options.get("kind") or "",
                    source_document=source_name,
                    page_number=page_number,
                    chunk_index=chunk_index,
                    text=chunk_text,
                    embedding=embedding,
                    embedding_model=EMBEDDING_MODEL,
                )
            )
            self.stdout.write(f"  embedded chunk {chunk_index + 1}/{len(page_chunks)} (p.{page_number})")
            time.sleep(EMBED_CALL_DELAY_SECONDS)

        # Wholesale replace: a re-ingest supersedes the prior chunk set
        # entirely (and unique_together on source_document/chunk_index
        # would collide otherwise).
        deleted, _ = VectorDocumentChunk.objects.filter(source_document=source_name).delete()
        VectorDocumentChunk.objects.bulk_create(rows)

        replaced = f" (replaced {deleted} existing)" if deleted else ""
        self.stdout.write(self.style.SUCCESS(f"Ingested {len(rows)} chunk(s) for '{source_name}'{replaced}."))
