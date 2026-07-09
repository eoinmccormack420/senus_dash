"""
PDF -> text extraction for the Senus source documents.

Uses pdfplumber rather than a raw text dump because Senus's financial
statements are tabular — pdfplumber's table extraction preserves row/
column structure far better than plain text extraction, which matters
a lot for Gemini correctly associating a number with its line item.

"""

from pathlib import Path
from typing import List

import pdfplumber 


def extract_text_and_tables(pdf_path: str) -> str:
    """
    Returns a single text blob combining page text and any detected
    tables (rendered as pipe-delimited rows) for the whole document.

    Tables are appended after each page's plain text rather than
    interleaved, since pdfplumber's table detection can occasionally
    miss cells — having both the raw text and the table view gives
    Gemini two chances to find the correct figure.
    """
    if not Path(pdf_path).exists():
        raise FileNotFoundError(f"No PDF found at {pdf_path}")

    parts: List[str] = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            parts.append(f"\n--- Page {page_num} ---\n")

            text = page.extract_text()
            if text:
                parts.append(text)

            tables = page.extract_tables()
            for t_idx, table in enumerate(tables):
                parts.append(f"\n[Table {t_idx + 1} on page {page_num}]")
                for row in table:
                    cleaned = [cell if cell else "" for cell in row]
                    parts.append(" | ".join(cleaned))

    return "\n".join(parts)


def has_extractable_text(pdf_path: str, min_chars: int = 200) -> bool:
    """
    True if the PDF has a real embedded text layer worth running through
    pdfplumber. False for scanned/photographed statutory filings, where
    every page is really just an image — pdfplumber's text and table
    extraction silently return nothing for those (no exception, no
    text), which upstream previously looked identical to "this document
    has no financial data" rather than "this document needs to be read
    as an image." Checking `page.chars` directly (rather than
    `page.extract_text()`) distinguishes the two cases cheaply, without
    paying for a Gemini call first.
    """
    if not Path(pdf_path).exists():
        raise FileNotFoundError(f"No PDF found at {pdf_path}")

    total_chars = 0
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            total_chars += len(page.chars)
            if total_chars >= min_chars:
                return True
    return False


def extract_relevant_section(full_text: str, keywords: List[str], window: int = 2000) -> str:
    """
    Optional trimming helper: pulls out a window of text around the
    first occurrence of any given keyword (e.g. "Consolidated Balance
    Sheet"). Useful if a document is long and you want to keep the
    Gemini prompt focused and reduce token usage/cost, rather than
    always sending the entire document.

    Falls back to the full text if no keyword is found.
    """
    lower_text = full_text.lower()
    for keyword in keywords:
        idx = lower_text.find(keyword.lower())
        if idx != -1:
            start = max(0, idx - 200)
            end = min(len(full_text), idx + window)
            return full_text[start:end]
    return full_text
