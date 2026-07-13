// src/components/ErrorBoundary.tsx
//
// Top-level React error boundary (mounted in App.tsx around the whole
// app) — catches render-time exceptions that would otherwise blank the
// page to a white screen, and shows a styled fallback instead. Must be
// a class component; React has no hook equivalent for
// getDerivedStateFromError/componentDidCatch.

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    console.error("Unhandled error in the board report app:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={page}>
        <div style={panel}>
          <p style={eyebrow}>Senus PLC</p>
          <h1 style={title}>Something went wrong</h1>
          <p style={message}>
            The board report hit an unexpected error. Reloading usually fixes it.
          </p>
          <button type="button" onClick={() => window.location.reload()} style={button}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-paper)",
  padding: "var(--space-4)",
  boxSizing: "border-box",
};

const panel: React.CSSProperties = {
  width: 360,
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: "var(--space-6) var(--space-5)",
  background: "var(--color-paper-raised)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card-hover)",
  textAlign: "center",
};

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-grey)",
  margin: "0 0 var(--space-2) 0",
};

const title: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "var(--text-xl)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-2) 0",
};

const message: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-grey)",
  margin: "0 0 var(--space-5) 0",
};

const button: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-base)",
  color: "var(--color-on-accent)",
  background: "var(--color-forest)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-3) var(--space-5)",
  cursor: "pointer",
  boxShadow: "var(--shadow-card)",
};
