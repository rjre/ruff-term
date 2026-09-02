interface TodoItem {
  title: string;
  note: string;
}

const ITEMS: TodoItem[] = [
  {
    title: "Company fundamentals",
    note: "Income statement / balance sheet / cash flow, consensus estimates, analyst ratings, valuation multiples over time. The actual core of FactSet/Bloomberg's daily use case, and currently a blank spot — Yahoo's key-stats/estimates endpoints now require an auth crumb this environment can't obtain, so this needs a real fundamentals provider.",
  },
  {
    title: "FX vol surface",
    note: "Implied vol by tenor/delta for G10 pairs. Placeholder shape exists on the FX tab; real numbers need Citi Velocity or an equivalent institutional FX API (rjre/fx-data), not available here.",
  },
  {
    title: "Rates & credit breadth",
    note: "Sovereign curves beyond UK/US (EU, JP, EM), plus credit spreads (IG/HY) and CDS. Only UK gilts (BoE) and US Treasury ETF proxies exist today.",
  },
  {
    title: "DMO gilt auction calendar",
    note: "US Treasury auctions are now live (Bond Auctions tab, via TreasuryDirect's own API). No equivalent scrapable feed was found for the DMO's UK gilt auction schedule — their site doesn't expose it as static HTML or an obvious JSON/CSV endpoint.",
  },
  {
    title: "Comps / peer tables",
    note: "Pick a holding, see it against sector peers on standard multiples. Blocked on the same fundamentals-feed gap as above.",
  },
  {
    title: "Real Excel plugin",
    note: "FactSet/Bloomberg's =FDS(...)-style Excel formulas. Not something a free/keyless data layer can replicate — paid-provider territory, flagged honestly rather than faked.",
  },
  {
    title: "Sentiment indicators (AAII, CBOE put/call)",
    note: "Checked both: aaii.com returns 403 to this environment (membership-gated beyond the current week's headline number), and CBOE's put/call ratio CSV endpoints returned 403/404. Neither has an accessible free feed from here — would need a different vantage point or a paid data reseller.",
  },
];

export function TodoPanel() {
  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">To Do</div>
          <div className="module-banner-sub">
            Known gaps versus a full FactSet/Bloomberg replacement, not yet built — tracked here
            instead of silently dropped.
          </div>
        </div>
      </div>

      <ul className="todo-list">
        {ITEMS.map((item) => (
          <li className="todo-item" key={item.title}>
            <div className="todo-item-title">{item.title}</div>
            <div className="todo-item-note">{item.note}</div>
          </li>
        ))}
      </ul>

      <div className="source-footer">Internal roadmap notes — no external data source.</div>
    </div>
  );
}
