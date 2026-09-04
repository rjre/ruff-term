interface Point {
  tenor: string;
  value: number | null;
}

interface CompareCurve {
  label: string;
  points: Point[];
  color?: string;
}

interface Props {
  points: Point[];
  color?: string;
  unit?: string;
  label?: string;
  /** A second curve on the same axes. Curves being compared don't always
   * quote the same tenors (a CDS index skips 6M/15Y/20Y/30Y that a
   * sovereign curve has) — the x-axis is built from the union of both
   * curves' tenors so each one still lines up at the tenors they share,
   * rather than two independently-spaced axes silently misaligning them. */
  compare?: CompareCurve;
}

/** "6M" -> 6, "1Y" -> 12, "10Y" -> 120 — for sorting a mixed tenor set into
 * calendar order, not for spacing (the axis stays rank-based; see below). */
function tenorToMonths(tenor: string): number {
  const match = /^(\d+(?:\.\d+)?)([MY])$/.exec(tenor.toUpperCase());
  if (!match) return Number.POSITIVE_INFINITY;
  const [, n, unit] = match;
  return unit === "Y" ? Number(n) * 12 : Number(n);
}

export function CurveChart({ points, color = "#4e9a33", unit = " bp", label, compare }: Props) {
  const valid = points.filter((p): p is { tenor: string; value: number } => p.value !== null);
  const compareValid = compare?.points.filter(
    (p): p is { tenor: string; value: number } => p.value !== null,
  ) ?? [];

  if (valid.length === 0 && compareValid.length === 0) {
    return <div className="empty-state">No data to chart.</div>;
  }

  const width = 640;
  const height = 340;
  const padding = { top: 28, right: 24, bottom: 40, left: 56 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  // Rank-based x-axis over the union of tenors, in calendar order — a term
  // structure is about how the market prices near vs far, not the literal
  // distance between tenor buckets, so even rank spacing (not proportional
  // to months) is the right axis even when the union has gaps.
  const tenors = Array.from(new Set([...valid, ...compareValid].map((p) => p.tenor))).sort(
    (a, b) => tenorToMonths(a) - tenorToMonths(b),
  );
  const indexOf = new Map(tenors.map((t, i) => [t, i]));

  const values = [...valid, ...compareValid].map((p) => p.value);
  const minV = Math.min(0, ...values);
  const maxV = Math.max(...values, 0);
  const range = maxV - minV || 1;

  const xFor = (tenor: string) =>
    padding.left + (tenors.length === 1 ? innerW / 2 : ((indexOf.get(tenor) ?? 0) / (tenors.length - 1)) * innerW);
  const yFor = (v: number) => padding.top + innerH - ((v - minV) / range) * innerH;

  const tickCount = 4;
  const tickValues = Array.from({ length: tickCount + 1 }, (_, i) => minV + (range * i) / tickCount);

  function renderCurve(
    curvePoints: Array<{ tenor: string; value: number }>,
    curveColor: string,
    labelOffset: number,
  ) {
    const linePoints = curvePoints.map((p) => `${xFor(p.tenor)},${yFor(p.value)}`).join(" ");
    return (
      <g>
        <polyline points={linePoints} fill="none" stroke={curveColor} strokeWidth={2} />
        {curvePoints.map((p) => (
          <g key={p.tenor}>
            <circle cx={xFor(p.tenor)} cy={yFor(p.value)} r={3.5} fill={curveColor} />
            <text
              x={xFor(p.tenor)}
              y={yFor(p.value) + labelOffset}
              textAnchor="middle"
              fontSize={11}
              fill={curveColor}
            >
              {p.value.toFixed(1)}
              {unit}
            </text>
          </g>
        ))}
      </g>
    );
  }

  return (
    <div>
      {compare && (
        <div className="chart-compare-legend">
          <span className="chart-compare-legend-item" style={{ color }}>
            ● {label ?? "Primary"}
          </span>
          <span className="chart-compare-legend-item" style={{ color: compare.color ?? "#c9922f" }}>
            ● {compare.label}
          </span>
        </div>
      )}
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
        {compare && renderCurve(compareValid, compare.color ?? "#c9922f", 18)}
        {renderCurve(valid, color, -10)}
        {tenors.map((t) => (
          <text
            key={t}
            x={xFor(t)}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-faint)"
          >
            {t}
          </text>
        ))}
      </svg>
    </div>
  );
}
