interface Line {
  label: string;
  pct: number;
}

interface Props {
  lines: Line[];
  hue: string;
  unit?: string;
}

/** Single-hue horizontal bar list for ranking magnitudes (currency mix,
 * geographic mix, UST volume by bucket, etc) — not identity, so one color. */
export function MagnitudeBarList({ lines, hue, unit = "%" }: Props) {
  const max = Math.max(...lines.map((l) => l.pct), 1);
  return (
    <div className="magnitude-list">
      {lines
        .slice()
        .sort((a, b) => b.pct - a.pct)
        .map((line) => (
          <div className="magnitude-row" key={line.label}>
            <span className="magnitude-label">{line.label}</span>
            <div className="magnitude-bar-track">
              <div
                className="magnitude-bar-fill"
                style={{ width: `${(line.pct / max) * 100}%`, background: hue }}
              />
            </div>
            <span className="magnitude-pct">
              {line.pct.toFixed(1)}
              {unit}
            </span>
          </div>
        ))}
    </div>
  );
}
