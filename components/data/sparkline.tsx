/**
 * Minimal SVG trend line — monochrome (currentColor), no axes, no legend.
 * Server-renderable (pure math, no client JS needed). Draws real data only;
 * pass an empty/flat series and it renders a flat baseline rather than
 * fabricating a trend.
 */
export function Sparkline({
  points,
  width = 120,
  height = 32,
  strokeWidth = 2,
  className,
}: {
  points: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
}) {
  if (points.length === 0) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className}>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.25}
        />
      </svg>
    );
  }

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = i * step;
    const y = height - ((p - min) / range) * (height - strokeWidth * 2) - strokeWidth;
    return [x, y] as const;
  });

  const path = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      fill="none"
    >
      <path
        d={path}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <circle cx={lastX} cy={lastY} r={strokeWidth + 1} fill="currentColor" />
    </svg>
  );
}
