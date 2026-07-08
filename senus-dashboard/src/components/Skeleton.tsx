// src/components/Skeleton.tsx
//
// Shape-matched loading placeholder (shimmering block), used wherever
// a chart/card/pill is still fetching. Sized to match the real content
// it precedes so the layout doesn't collapse and reflow once data
// arrives — see tokens.css for the shimmer animation itself.

interface Props {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}

export function Skeleton({ width = "100%", height = 16, radius = "var(--radius-sm)", style }: Props) {
  return (
    <div
      className="skeleton"
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}
