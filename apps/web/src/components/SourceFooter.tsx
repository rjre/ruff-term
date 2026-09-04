export interface SourceLink {
  label: string;
  url: string;
}

type Source = string | SourceLink;

interface Props {
  sources: Source[];
}

/**
 * Consistent "what powers this page" line for the bottom of every tab.
 *
 * A source with a real, stable URL to the underlying data — an official
 * publication, a series page, a public feed — renders as a link. A plain
 * string is for the cases with nothing to link to: a demo/placeholder
 * panel, or a note like "impact text: rule-based heuristic" describing this
 * app's own logic rather than an external source.
 */
export function SourceFooter({ sources }: Props) {
  return (
    <div className="source-footer">
      Source{sources.length > 1 ? "s" : ""}:{" "}
      {sources.map((source, i) => (
        // Index is fine here: this list is a fixed set of labels/links
        // built fresh from render-time data, not a reorderable collection —
        // and two sources can legitimately share a label or URL (e.g. the
        // same Citi Velocity link cited for two different reasons).
        <span key={i}>
          {i > 0 ? " · " : ""}
          {typeof source === "string" ? (
            source
          ) : (
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.label}
            </a>
          )}
        </span>
      ))}
    </div>
  );
}
