import { useEffect, useState, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { CHART_WIDTH } from "../styles/chartTheme";

export function ResponsiveChartContainer({
  height,
  children,
}: {
  height: number;
  children: ReactNode;
}) {
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("print");

    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsPrinting(event.matches);
    };

    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);

    if (mediaQuery) {
      setIsPrinting(mediaQuery.matches);
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", handleMediaChange);
      } else if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(handleMediaChange);
      }
    }

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === "function") {
          mediaQuery.removeEventListener("change", handleMediaChange);
        } else if (typeof mediaQuery.removeListener === "function") {
          mediaQuery.removeListener(handleMediaChange);
        }
      }
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width={isPrinting ? CHART_WIDTH : "100%"} height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
