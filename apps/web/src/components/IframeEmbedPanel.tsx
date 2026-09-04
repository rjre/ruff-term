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
    <div className="iframe-embed-page">
      <div className="iframe-embed-banner">
        <div>
          <div className="module-banner-title">{title}</div>
          <div className="module-banner-sub">{subtitle}</div>
        </div>
        <SourceFooter sources={[{ label: `${repoLabel} (embedded live)`, url: src }]} />
      </div>
      <iframe src={src} title={title} className="iframe-embed-frame" />
    </div>
  );
}
