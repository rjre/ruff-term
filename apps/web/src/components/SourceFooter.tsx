interface Props {
  sources: string[];
}

/** Consistent "what powers this page" line for the bottom of every tab. */
export function SourceFooter({ sources }: Props) {
  return (
    <div className="source-footer">
      Source{sources.length > 1 ? "s" : ""}: {sources.join(" · ")}
    </div>
  );
}
