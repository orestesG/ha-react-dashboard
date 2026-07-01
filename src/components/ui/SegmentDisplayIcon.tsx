interface Props {
  size?: number;
  className?: string;
}

// 7-segment digit showing "2" (segments: top, top-right, middle, bot-left, bottom)
// Unlit segments (top-left, bot-right) rendered at low opacity for the LCD ghost effect
function Digit({ x, y }: { x: number; y: number }) {
  return (
    <g fill="currentColor">
      {/* unlit: top-left (f) */}
      <rect x={x}      y={y + 1}   width={1} height={3} rx={0.4} opacity={0.12} />
      {/* unlit: bot-right (c) */}
      <rect x={x + 4}  y={y + 4.5} width={1} height={3} rx={0.4} opacity={0.12} />
      {/* lit: top (a) */}
      <rect x={x + 0.5} y={y}       width={3.5} height={1}   rx={0.4} />
      {/* lit: top-right (b) */}
      <rect x={x + 4}   y={y + 1}   width={1}   height={3}   rx={0.4} />
      {/* lit: middle (g) */}
      <rect x={x + 0.5} y={y + 4}   width={3.5} height={1}   rx={0.4} />
      {/* lit: bot-left (e) */}
      <rect x={x}        y={y + 4.5} width={1}   height={3}   rx={0.4} />
      {/* lit: bottom (d) */}
      <rect x={x + 0.5} y={y + 7.5} width={3.5} height={1}   rx={0.4} />
    </g>
  );
}

export function SegmentDisplayIcon({ size = 16, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      {/* Display panel frame */}
      <rect x="0.75" y="5" width="22.5" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      {/* Two "2" digits centered in the panel */}
      <Digit x={5.5}  y={7.5} />
      <Digit x={13.5} y={7.5} />
    </svg>
  );
}
