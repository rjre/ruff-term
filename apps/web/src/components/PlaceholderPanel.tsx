import { SourceFooter } from "./SourceFooter";

interface Props {
  title: string;
}

export function PlaceholderPanel({ title }: Props) {
  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">{title}</div>
        </div>
      </div>
      <div className="tbc-placeholder">TBC</div>
      <SourceFooter sources={["TBC — no source yet"]} />
    </div>
  );
}
