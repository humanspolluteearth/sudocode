// Per-viewer settings kept in the browser (theme and zoom). Storage can be missing or blocked (private windows,
// tests), so every read and write is wrapped: the app works the same without it.
import { ZOOM_MAX, ZOOM_MIN, type ThemeChoice } from "./Toolbar.tsx";

const KEY = "sudocode.preferences";

export interface Preferences {
  theme: ThemeChoice;
  zoom: number;
}

export const DEFAULT_PREFERENCES: Preferences = { theme: "system", zoom: 100 };

export function parseTheme(value: unknown): ThemeChoice {
  return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_PREFERENCES.theme;
}

export function clampZoom(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_PREFERENCES.zoom;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value / 10) * 10));
}

export function loadPreferences(): Preferences {
  try {
    const raw: unknown = JSON.parse(globalThis.localStorage.getItem(KEY) ?? "null");
    if (typeof raw === "object" && raw !== null) {
      const { theme, zoom } = raw as Record<string, unknown>;
      return { theme: parseTheme(theme), zoom: clampZoom(zoom) };
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
