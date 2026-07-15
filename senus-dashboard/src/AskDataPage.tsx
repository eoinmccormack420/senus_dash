// src/AskDataPage.tsx
//
// "Ask the Data" (/ask, see App.tsx) — plain-English Q&A over the
// hybrid RAG layer: every answer is grounded in validated figures,
// retrieved source-document excerpts (cited by page), and the
// regulatory knowledge graph (board/extraction/qa.py). The citations
// are the point: a board member can trace every claim back to a real
// document or a validated figure, and every Q&A is kept as an audit
// row (BoardQuestion) shown in the history below.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  askApi,
  boardApi,
  type BoardQuestionRecord,
  type CurrentUser,
  type PeriodSummary,
} from "./api/client";
import { AccountMenu } from "./components/AccountMenu";
import { ChatIcon, SparkleIcon } from "./components/icons";
import "./styles/tokens.css";
import { page, header, eyebrow, titleRow, heroIconBadge, title, backLink, subheading, askCard, questionInput, askControls, periodSelect, askButton, buttonSpinner, errorText, sectionHeading, answerCard, answerHeader, answerHeaderText, answerQuestion, answerMeta, chevron, collapseWrapper, collapseInner, answerBadgeRow, aiBadge, answerBody, answerBodyHeader, answerBodyLabel, answerText, answerHeading, answerSubheading, answerParagraph, answerBullet, answerBulletMarker, sourcesList, sourcePill } from "./styles/AskDataPageStyles";

export default function AskDataPage({
  currentUser,
  onSignOut,
}: {
  currentUser: CurrentUser | null;
  onSignOut: () => void;
}) {
  const [periods, setPeriods] = useState<PeriodSummary[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<BoardQuestionRecord | null>(null);
  const [history, setHistory] = useState<BoardQuestionRecord[]>([]);

  useEffect(() => {
    boardApi
      .listPeriods()
      .then((list) => {
        setPeriods(list);
        // The list endpoint orders by end_date ascending — latest is last.
        if (list.length > 0) setSelectedPeriod(list[list.length - 1].label);
      })
      .catch(() => setPeriods([]));
    loadHistory();
  }, []);

  function loadHistory() {
    askApi
      .history()
      .then(setHistory)
      .catch(() => setHistory([]));
  }

  async function handleAsk() {
    const trimmed = question.trim();
    if (!trimmed || asking) return;
    setAsking(true);
    setError(null);
    try {
      const record = await askApi.ask(trimmed, selectedPeriod || undefined);
      setAnswer(record);
      setQuestion("");
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't answer that question.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div style={page}>
      <header style={header}>
        <div>
          <p style={eyebrow}>Senus PLC</p>
          <div style={titleRow}>
            <span style={heroIconBadge}>
              <ChatIcon size={16} />
            </span>
            <h1 style={title}>Ask the Data</h1>
            <Link to="/" style={backLink}>
              ← Back to dashboard
            </Link>
          </div>
          <p style={subheading}>
            Answers grounded in validated figures, source documents, and the regulatory knowledge graph — every claim
            cited.
          </p>
        </div>
        <AccountMenu user={currentUser} onSignOut={onSignOut} />
      </header>

      <section className="card" style={askCard}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
          }}
          placeholder='e.g. "What did management say about the cash position and outlook?"'
          rows={3}
          style={questionInput}
        />
        <div style={askControls}>
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} style={periodSelect}>
            {periods.map((p) => (
              <option key={p.id} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleAsk} disabled={asking || !question.trim()} style={askButton}>
            {asking ? (
              <>
                <span className="spinner" style={buttonSpinner} /> Searching documents and figures…
              </>
            ) : (
              "Ask"
            )}
          </button>
        </div>
        {error && <p style={errorText}>{error}</p>}
      </section>

      {answer && <AnswerCard record={answer} defaultOpen />}

      {history.length > 0 && (
        <>
          <h2 style={sectionHeading}>Recent Questions</h2>
          {history
            .filter((h) => h.id !== answer?.id)
            .map((record) => (
              <AnswerCard key={record.id} record={record} />
            ))}
        </>
      )}
    </div>
  );
}

function stripMarkdown(text: string) {
  // "# " / "## " heading markers are left intact here — renderAnswerText
  // parses those itself to distinguish heading/subheading/paragraph.
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[(Source|source|Sources|sources)(?:\s+[A-Za-z0-9.\-_/]+)?\]/gi, "")
    .replace(/\[[A-Za-z0-9_.\-/]+(?:\s*,\s*[A-Za-z0-9_.\-/]+)*\]/g, "")
    .replace(/\[(?:yoy|cashliquidity|boardnotes|source|sources)[^\]]*\]/gi, "")
    .replace(/^>\s?/gm, "")
    .replace(/[*_~`]+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderAnswerText(text: string) {
  const lines = text.split(/\n/);
  const nodes: React.JSX.Element[] = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      if (index < lines.length - 1 && lines[index + 1]?.trim()) {
        nodes.push(<div key={`sp-${index}`} style={{ height: 8 }} />);
      }
      return;
    }

    if (/^##\s+/.test(line)) {
      nodes.push(
        <h4 key={`subheading-${index}`} style={answerSubheading}>
          {line.replace(/^##\s+/, "")}
        </h4>,
      );
      return;
    }

    if (/^#\s+/.test(line)) {
      nodes.push(
        <h3 key={`heading-${index}`} style={answerHeading}>
          {line.replace(/^#\s+/, "")}
        </h3>,
      );
      return;
    }

    if (/^\s*(•|[-*])\s+/.test(line)) {
      nodes.push(
        <p key={`bullet-${index}`} style={answerBullet}>
          <span style={answerBulletMarker}>•</span>
          <span>{line.replace(/^\s*(•|[-*])\s+/, "")}</span>
        </p>,
      );
      return;
    }

    nodes.push(
      <p key={`paragraph-${index}`} style={answerParagraph}>
        {line}
      </p>,
    );
  });

  return <>{nodes}</>;
}

function AnswerCard({ record, defaultOpen = false }: { record: BoardQuestionRecord; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const plainAnswer = stripMarkdown(record.answer);
  const sourceName = record.context_chunks[0]?.source_document.split(/[\\/]/).pop() || "Source";

  return (
    <section className="card" style={answerCard}>
      <button type="button" onClick={() => setOpen(!open)} className="disclosure-row" style={answerHeader}>
        <div style={answerHeaderText}>
          <p style={answerQuestion}>{record.question}</p>
          <p style={answerMeta}>
            {record.period}
            {record.asked_by ? ` · ${record.asked_by}` : ""} · {new Date(record.created_at).toLocaleString()}
          </p>
        </div>
        <span style={{ ...chevron, transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
      </button>

      <div style={{ ...collapseWrapper, gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div style={collapseInner}>
          <div style={answerBadgeRow}>
            <span style={aiBadge}>
              <SparkleIcon size={9} /> AI-Generated — verify against cited sources
            </span>
          </div>

          <div style={answerBody}>
            <div style={answerBodyHeader}>
              <span style={answerBodyLabel}>Answer</span>
            </div>
            <div style={answerText}>{renderAnswerText(plainAnswer)}</div>
          </div>

          {record.context_chunks.length > 0 && (
            <div style={sourcesList}>
              <span style={sourcePill}>{sourceName}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
