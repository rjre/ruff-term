import { SourceFooter } from "./SourceFooter";

interface Props {
  title: string;
  subtitle: string;
  src: string;
  repoLabel: string;
}

/** Embeds a live, already-deployed GitHub Pages tool by iframe rather than
 * re-implementing its (often hand-rolled) charting logic. */
export function IframeEmbedPanel({ title, subtitle, src, repoLabel }: Props) {
  return (
    <div className="module-view" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="module-banner">
        <div>
          <div className="module-banner-title">{title}</div>
          <div className="module-banner-sub">{subtitle}</div>
        </div>
      </div>
      <iframe
        src={src}
        title={title}
        style={{ flex: 1, minHeight: 600, width: "100%", border: "1px solid var(--border)" }}
      />
      <SourceFooter sources={[`${repoLabel} (embedded live)`]} />
    </div>
  );
}
