import type { MacroSnapshot } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";
import { loadPanels, type PanelDef } from "./instrumentPanels.js";

const PANEL_DEFS: PanelDef[] = [
  {
    title: "Energy",
    instruments: [
      { ticker: "CL=F", label: "WTI Crude" },
      { ticker: "BZ=F", label: "Brent Crude" },
      { ticker: "NG=F", label: "Nat Gas" },
      { ticker: "RB=F", label: "RBOB Gasoline" },
      { ticker: "HO=F", label: "Heating Oil" },
    ],
  },
  {
    title: "Metals",
    instruments: [
      { ticker: "GC=F", label: "Gold" },
      { ticker: "SI=F", label: "Silver" },
      { ticker: "PL=F", label: "Platinum" },
      { ticker: "PA=F", label: "Palladium" },
      { ticker: "HG=F", label: "Copper" },
    ],
  },
  {
    title: "Agriculture",
    instruments: [
      { ticker: "ZC=F", label: "Corn" },
      { ticker: "ZW=F", label: "Wheat" },
      { ticker: "ZS=F", label: "Soybeans" },
      { ticker: "KC=F", label: "Coffee" },
      { ticker: "SB=F", label: "Sugar" },
      { ticker: "CT=F", label: "Cotton" },
      { ticker: "CC=F", label: "Cocoa" },
    ],
  },
  {
    title: "Broad Index",
    instruments: [{ ticker: "DBC", label: "Commodity Index (CRB proxy)" }],
  },
];

const cache = new TtlCache<MacroSnapshot>(60_000);

async function loadSnapshot(): Promise<MacroSnapshot> {
  const panels = await loadPanels(PANEL_DEFS);
  return { asOf: new Date().toISOString(), panels };
}

export async function getCommoditiesSnapshot(): Promise<MacroSnapshot> {
  return cache.getOrLoad("snapshot", loadSnapshot);
}
