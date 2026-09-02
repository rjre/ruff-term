import { useEffect, useState } from "react";
import type { ResearchItem } from "@ruff-term/shared";
import { fetchResearch } from "../api/client";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ResearchPanel() {
  const [items, setItems] = useState<ResearchItem[] | null>(null);

  useEffect(() => {
    fetchResearch()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Ruffer Research</div>
          <div className="module-banner-sub">Demo content for now — not real Ruffer research output.</div>
        </div>
      </div>
      <div className="research-grid">
        {items === null ? (
          <div className="empty-state">Loading research…</div>
        ) : (
          items.map((item) => (
            <article key={item.id} className="research-card">
              <div className="research-card-top">
                <span className="research-tag">{item.category}</span>
                <span className="research-meta">{item.readTimeMinutes} min read</span>
              </div>
              <h3 className="research-title">{item.title}</h3>
              <p className="research-summary">{item.summary}</p>
              <div className="research-footer">
                <span>{item.author}</span>
                <span>{formatDate(item.publishedAt)}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
