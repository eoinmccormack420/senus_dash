// src/components/ErrorBoundary.tsx
//
// Top-level React error boundary (mounted in App.tsx around the whole
// app) — catches render-time exceptions that would otherwise blank the
// page to a white screen, and shows a styled fallback instead. Must be
// a class component; React has no hook equivalent for
// getDerivedStateFromError/componentDidCatch.

import { Component, type ReactNode } from "react";
import { page, panel, eyebrow, title, message, button } from "../styles/ErrorBoundaryStyles";

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
