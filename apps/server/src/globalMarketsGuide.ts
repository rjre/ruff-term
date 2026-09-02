import type { GlobalMarketsGuideCountry } from "@ruff-term/shared";
import countries from "./data/globalMarketsGuide.json" with { type: "json" };

/**
 * Extracted from UBS's own "2025 Guide to Global Markets" PDF (152 pages,
 * ~52 countries) via pdftotext + a field parser (Region/Currency/Time Zone/
 * Primary Exchange/Hours/Primary Equity Index/Bloomberg ticker). A handful
 * of countries have gaps where the PDF's layout didn't match the parser
 * (shown as blank rather than guessed) — see apps/server/src/data/
 * globalMarketsGuide.json for exactly what was pulled.
 */
export function getGlobalMarketsGuide(): GlobalMarketsGuideCountry[] {
  return countries as GlobalMarketsGuideCountry[];
}
