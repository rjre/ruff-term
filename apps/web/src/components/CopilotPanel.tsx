import { SourceFooter } from "./SourceFooter";

export function CopilotPanel() {
  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Copilot</div>
        </div>
      </div>
      <div className="note-banner">Embed the M&amp;E Market Commentary Agent</div>
      <div className="tbc-placeholder">TBC</div>
      <SourceFooter sources={["Pending — intended source: M&E Market Commentary Agent"]} />
    </div>
  );
}
