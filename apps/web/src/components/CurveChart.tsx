interface Point {
  tenor: string;
  value: number | null;
}

interface Props {
  points: Point[];
  color?: string;
  unit?: string;
}

/**
 * A labeled curve chart for a term structure — tenor on the x-axis at even
 * intervals (by rank, not by actual calendar spacing: the point of a term
 * structure is "how does the market price 1Y vs 10Y", not the raw distance
 * between them), value on the y-axis. Plain SVG rather than lightweight-
 * charts, which expects a real time axis and isn't a fit for a handful of
 * categorical tenor buckets.
 */
export function CurveChart({ points, color = "#4e9a33", unit = " bp" }: Props) {
  const valid = points.filter(
    (p): p is { tenor: string; value: number } => p.value !== null,
  );
  if (valid.length === 0) {
    return <div className="empty-state">No data to chart.</div>;
  }

  const width = 640;
  const height = 340;
  const padding = { top: 28, right: 24, bottom: 40, left: 56 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const values = valid.map((p) => p.value);
  const minV = Math.min(0, ...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const xFor = (i: number) =>
    padding.left + (valid.length === 1 ? innerW / 2 : (i / (valid.length - 1)) * innerW);
  const yFor = (v: number) => padding.top + innerH - ((v - minV) / range) * innerH;

  const linePoints = valid.map((p, i) => `${xFor(i)},${yFor(p.value)}`).join(" ");

  const tickCount = 4;
  const tickValues = Array.from({ length: tickCount + 1 }, (_, i) => minV + (range * i) / tickCount);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width, height: "auto" }}>
      {tickValues.map((v) => (
        <g key={v}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={yFor(v)}
            y2={yFor(v)}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text
            x={padding.left - 8}
            y={yFor(v)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={11}
            fill="var(--text-faint)"
          >
            {v.toFixed(0)}
          </text>
        </g>
      ))}
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth={2} />
      {valid.map((p, i) => (
        <g key={p.tenor}>
          <circle cx={xFor(i)} cy={yFor(p.value)} r={3.5} fill={color} />
          <text x={xFor(i)} y={yFor(p.value) - 10} textAnchor="middle" fontSize={11} fill="var(--text)">
            {p.value.toFixed(1)}
            {unit}
          </text>
          <text
            x={xFor(i)}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-faint)"
          >
            {p.tenor}
          </text>
        </g>
      ))}
    </svg>
  );
}
