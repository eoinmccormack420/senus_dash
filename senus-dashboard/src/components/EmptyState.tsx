import type { ReactNode } from "react";
import { style } from "../styles/EmptyStateStyles";

export default function EmptyState({ children }: { children: ReactNode }) {
  return <div style={style}>{children}</div>;
}
