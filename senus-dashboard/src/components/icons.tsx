// Minimal inline stroke-SVG icon set for /readiness's card/section
// headers — no icon library dependency for a handful of glyphs.
// Consistent with feather/lucide's stroke style (24x24 viewBox,
// stroke="currentColor", no fill) so they inherit color/size from
// whatever badge wraps them.

type IconProps = { size?: number };

export function RouteIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <path d="M8.3 18h7.2a4 4 0 0 0 4-4v-1a4 4 0 0 0-4-4H8.5a4 4 0 0 1-4-4V5" />
    </svg>
  );
}

export function ChecklistIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6l1.5 1.5L8 5" />
      <path d="M11 6h9" />
      <path d="M4 12l1.5 1.5L8 11" />
      <path d="M11 12h9" />
      <path d="M4 18l1.5 1.5L8 17" />
      <path d="M11 18h9" />
    </svg>
  );
}

export function TargetIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MapPinIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-5.6-7-11.2A7 7 0 0 1 19 9.8C19 15.4 12 21 12 21z" />
      <circle cx="12" cy="9.8" r="2.5" />
    </svg>
  );
}

export function SparkleIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" />
    </svg>
  );
}
