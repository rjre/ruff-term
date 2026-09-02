export type Theme = "light" | "dark";

const THEME_KEY = "ruff-term:theme";

export function loadTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(
    new CustomEvent("ruff-term:theme-change", { detail: theme }),
  );
}

/** Reads a CSS custom property's current computed value off <html> —
 * for consumers (e.g. lightweight-charts) that need a literal color string
 * rather than a live `var(--x)` reference. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
