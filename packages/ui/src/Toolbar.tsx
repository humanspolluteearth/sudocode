// The toolbar: Run, Stop, zoom and theme. Buttons are real <button>s with visible text for screen readers.
import { parseTheme } from "./preferences.ts";
export type ThemeChoice = "system" | "light" | "dark";

export const ZOOM_MIN = 100;
export const ZOOM_MAX = 150;
export const ZOOM_STEP = 10;

export interface ToolbarProps {
  running: boolean;
  /** False while there is no way to run (no worker factory supplied). */
  canRun: boolean;
  onRun: () => void;
  onStop: () => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  theme: ThemeChoice;
  onTheme: (theme: ThemeChoice) => void;
}

export function Toolbar(p: ToolbarProps) {
  return (
    <div className="sc-toolbar" role="toolbar" aria-label="Run controls">
      <button type="button" className="sc-tb" onClick={p.onRun} disabled={p.running || !p.canRun} title="Run (F5)">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 2.5v11l9-5.5z" style={{ fill: p.running || !p.canRun ? "currentColor" : "var(--green)" }} />
        </svg>
        Run
      </button>
      <button type="button" className="sc-tb" onClick={p.onStop} disabled={!p.running} title="Stop (Shift+F5)">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="3.5" y="3.5" width="9" height="9" style={{ fill: p.running ? "var(--red)" : "currentColor" }} />
        </svg>
        Stop
      </button>
      <span className="sc-sep" aria-hidden="true" />
      <button
        type="button"
        className="sc-tb"
        onClick={() => {
          p.onZoom(Math.max(ZOOM_MIN, p.zoom - ZOOM_STEP));
        }}
        disabled={p.zoom <= ZOOM_MIN}
        aria-label="Zoom out"
        title="Zoom out"
      >
        A−
      </button>
      <span aria-live="polite" aria-label="Zoom level">{`${String(p.zoom)}%`}</span>
      <button
        type="button"
        className="sc-tb"
        onClick={() => {
          p.onZoom(Math.min(ZOOM_MAX, p.zoom + ZOOM_STEP));
        }}
        disabled={p.zoom >= ZOOM_MAX}
        aria-label="Zoom in"
        title="Zoom in"
      >
        A+
      </button>
      <span className="sc-sep" aria-hidden="true" />
      <label>
        <span style={{ marginRight: 4 }}>Theme</span>
        <select
          value={p.theme}
          onChange={(e) => {
            p.onTheme(parseTheme(e.target.value));
          }}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </div>
  );
}
