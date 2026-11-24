// Per-viewer settings kept in the browser (theme and zoom). Storage can be missing or blocked (private windows,
// tests), so every read and write is wrapped: the app works the same without it.
import { ZOOM_LEVELS, type ThemeChoice } from "./Toolbar.tsx";

/** The languages the editor offers. */
export type PseudocodeLanguage = "edexcel" | "cie" | "python";

const KEY = "sudocode.preferences";

export interface Preferences {
  theme: ThemeChoice;
  zoom: number;
  /** Advanced mode (docs/PRODUCT.md): shows the Files panel. Simple is the default. */
  advanced: boolean;
  /** Which pseudocode the editor, checker and runs use. */
  language: PseudocodeLanguage;
}

export const DEFAULT_PREFERENCES: Preferences = { theme: "system", zoom: 100, advanced: false, language: "edexcel" };

export function parseTheme(value: unknown): ThemeChoice {
  return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_PREFERENCES.theme;
}

export function clampZoom(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_PREFERENCES.zoom;
  // The nearest size the design offers (so a stored 117 becomes 120 and 125 stays 125).
  return ZOOM_LEVELS.reduce((best, z) => (Math.abs(z - value) < Math.abs(best - value) ? z : best));
}

export function loadPreferences(): Preferences {
  try {
    const raw: unknown = JSON.parse(globalThis.localStorage.getItem(KEY) ?? "null");
    if (typeof raw === "object" && raw !== null) {
      const { theme, zoom, advanced, language } = raw as Record<string, unknown>;
      return {
        theme: parseTheme(theme),
        zoom: clampZoom(zoom),
        advanced: advanced === true,
        language: language === "cie" || language === "python" ? language : "edexcel",
      };
    }
  } catch {
    // Missing, blocked or corrupt storage: use the defaults.
  }
  return DEFAULT_PREFERENCES;
}

export function savePreferences(preferences: Preferences): void {
  try {
    globalThis.localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    // Not saved; nothing else to do.
  }
}
