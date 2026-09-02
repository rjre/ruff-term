import { SourceFooter } from "./SourceFooter";

const SECTIONS = ["Portfolio views", "Attribution", "Holdings charts"];

export function AladdinExplorePanel() {
  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Aladdin Explore</div>
          <div className="module-banner-sub">
            A number of people don't have Aladdin Explore access — this page is meant to surface the
            same portfolio views, attribution and holdings charts here instead.
          </div>
        </div>
      </div>
      <div className="research-grid">
        {SECTIONS.map((title) => (
          <div className="tbc-placeholder" key={title}>
            <div>
              <div style={{ fontSize: 13, marginBottom: 8, color: "var(--text-dim)" }}>{title}</div>
              TBC
            </div>
          </div>
        ))}
      </div>
      <SourceFooter sources={["Pending — intended source: Aladdin Explore"]} />
    </div>
  );
}
