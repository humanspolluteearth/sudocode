// The toolbar: Run, the debugger buttons (Continue, Step over, Pause), Stop, zoom and theme. Buttons are real <button>s with visible text for screen readers.
import type { Example } from "@sudocode/core";
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
  /** True while the run is paused (at a breakpoint, after a step, or by Pause). */
  paused?: boolean;
  onContinue?: () => void;
  onStepOver?: () => void;
  onPause?: () => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  theme: ThemeChoice;
  onTheme: (theme: ThemeChoice) => void;
  examples: readonly Example[];
  onExample: (example: Example) => void;
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
      <button type="button" className="sc-tb" onClick={p.onContinue} disabled={p.paused !== true} title="Continue (F8)">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="2.5" y="3" width="2" height="10" style={{ fill: "currentColor" }} />
          <path d="M6.5 3v10l7-5z" style={{ fill: p.paused === true ? "var(--green)" : "currentColor" }} />
        </svg>
        Continue
      </button>
      <button
        type="button"
        className="sc-tb"
        onClick={p.onStepOver}
        disabled={p.paused !== true}
        title="Step over (F10)"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 9a6 6 0 0 1 11-3" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.5 }} />
          <path d="M14 3v4h-4z" style={{ fill: "currentColor" }} />
          <circle cx="8" cy="13" r="1.6" style={{ fill: "currentColor" }} />
        </svg>
        Step over
      </button>
      <button
        type="button"
        className="sc-tb"
        onClick={p.onPause}
        disabled={!p.running || p.paused === true}
        title="Pause"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="4" y="3" width="2.5" height="10" style={{ fill: "currentColor" }} />
          <rect x="9.5" y="3" width="2.5" height="10" style={{ fill: "currentColor" }} />
        </svg>
        Pause
      </button>
      <span className="sc-sep" aria-hidden="true" />
      <label className="sc-field">
        Examples
        <select
          value=""
          onChange={(e) => {
            const picked = p.examples.find((x) => x.id === e.target.value);
            if (picked !== undefined) p.onExample(picked);
          }}
        >
          <option value="">Choose…</option>
          {p.examples.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <span className="sc-sep" aria-hidden="true" />
      <button
        type="button"
        className="sc-tb"
        onClick={() => {
          p.onZoom(Math.max(ZOOM_MIN, p.zoom - ZOOM_STEP));
        }}
        disabled={p.zoom <= ZOOM_MIN}
        aria-label="A− Zoom out"
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
        aria-label="A+ Zoom in"
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
