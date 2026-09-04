interface Line {
  label: string;
  pct: number;
  /** Identity for selection, when the caller wants rows clickable — falls
   * back to `label`. Irrelevant when `onSelect` isn't passed. */
  key?: string;
}

interface Props {
  lines: Line[];
  hue: string;
  unit?: string;
  /** Makes each row clickable, reporting back the clicked line's `key` (or
   * `label` if it didn't set one). Omit for a plain, non-interactive list. */
  onSelect?: (key: string) => void;
  selectedKey?: string;
}

/** Single-hue horizontal bar list for ranking magnitudes (currency mix,
 * geographic mix, UST volume by bucket, etc) — not identity, so one color. */
export function MagnitudeBarList({ lines, hue, unit = "%", onSelect, selectedKey }: Props) {
  const max = Math.max(...lines.map((l) => l.pct), 1);
  return (
    <div className="magnitude-list">
      {lines
        .slice()
        .sort((a, b) => b.pct - a.pct)
        .map((line) => {
          const key = line.key ?? line.label;
          const classes = ["magnitude-row"];
          if (onSelect) classes.push("magnitude-row-clickable");
          if (key === selectedKey) classes.push("magnitude-row-selected");
          return (
            <div
              className={classes.join(" ")}
              key={key}
              onClick={onSelect ? () => onSelect(key) : undefined}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
            >
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
          );
        })}
    </div>
  );
}
