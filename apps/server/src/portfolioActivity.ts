import type { PortfolioAction, PortfolioActivitySnapshot } from "@ruff-term/shared";
import { DEFAULT_WATCHLIST } from "./marketData.js";
import { KNOWN_NAMES } from "./mockData.js";

/** Deterministic pseudo-random generator so the demo week's activity is
 * stable within a day rather than reshuffling on every request. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const ACTIONS: PortfolioAction["action"][] = ["Buy", "Sell", "Add", "Trim"];
const NOTES: Record<PortfolioAction["action"], string[]> = {
  Buy: ["New position initiated", "Opening allocation on valuation grounds", "Adding fresh exposure"],
  Add: ["Topping up an existing position", "Increasing conviction weighting", "Scaling into strength"],
  Trim: ["Taking partial profits", "Reducing after strong run", "Rebalancing back to target weight"],
  Sell: ["Position closed", "Exiting on thesis change", "Full disposal to fund other ideas"],
};

function startOfWeek(reference: Date): Date {
  const d = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d;
}

function generateActions(now: Date): PortfolioAction[] {
  const weekStart = startOfWeek(now);
  const daySeed = now.toISOString().slice(0, 10);
  const rand = seededRandom(`activity-${daySeed}`);
  const tickers = DEFAULT_WATCHLIST;
  const count = 6 + Math.floor(rand() * 5); // 6-10 demo actions this week
  const msPerDay = 86_400_000;
  const daysElapsed = Math.max(1, Math.floor((now.getTime() - weekStart.getTime()) / msPerDay) + 1);

  const actions: PortfolioAction[] = [];
  for (let i = 0; i < count; i++) {
    const ticker = tickers[Math.floor(rand() * tickers.length)];
    const action = ACTIONS[Math.floor(rand() * ACTIONS.length)];
    const dayOffset = Math.floor(rand() * daysElapsed);
    const date = new Date(weekStart.getTime() + dayOffset * msPerDay + Math.floor(rand() * 8 + 8) * 3_600_000);
    const price = Math.round((10 + rand() * 300) * 100) / 100;
    const quantity = Math.round((500 + rand() * 9500) / 50) * 50;
    const valueGBP = Math.round(price * quantity * 0.78); // rough FX-neutral GBP notional for demo purposes
    const notes = NOTES[action];
    actions.push({
      id: `demo-act-${daySeed}-${i}`,
      date: date.toISOString(),
      ticker,
      name: KNOWN_NAMES[ticker] ?? ticker,
      action,
      quantity,
      price,
      currency: "USD",
      valueGBP,
      note: notes[Math.floor(rand() * notes.length)],
    });
  }

  return actions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPortfolioActivity(): PortfolioActivitySnapshot {
  const now = new Date();
  const actions = generateActions(now);
  const isBuySide = (a: PortfolioAction["action"]) => a === "Buy" || a === "Add";
  const totalBuysGBP = actions.filter((a) => isBuySide(a.action)).reduce((s, a) => s + a.valueGBP, 0);
  const totalSellsGBP = actions.filter((a) => !isBuySide(a.action)).reduce((s, a) => s + a.valueGBP, 0);

  return {
    weekStart: startOfWeek(now).toISOString(),
    actions,
    totalBuysGBP,
    totalSellsGBP,
    netFlowGBP: totalBuysGBP - totalSellsGBP,
  };
}
