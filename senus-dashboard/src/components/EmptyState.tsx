import type { ReactNode } from "react";

const style: React.CSSProperties = {
  padding: "var(--space-8)",
  textAlign: "center",
  border: "1px dashed var(--color-grey-line)",
  borderRadius: "var(--radius-md)",
  color: "var(--color-grey-text)",
};

export default function EmptyState({ children }: { children: ReactNode }) {
  return <div style={style}>{children}</div>;
}
