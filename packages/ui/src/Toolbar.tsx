// The toolbar: Run, the debugger buttons (Continue, Step over, Pause), Stop, zoom and theme. Buttons are real <button>s with visible text for screen readers.
import { ALL_TOOLS, type ToolFlags } from "./tools.ts";
import type { Example } from "@sudocode/core";
import type { PseudocodeLanguage } from "./preferences.ts";
export type ThemeChoice = "system" | "light" | "dark";

export const ZOOM_MIN = 100;
export const ZOOM_MAX = 150;
/** The sizes the design offers; Zoom in/out and Ctrl+= / Ctrl+- move along this ladder. */
export const ZOOM_LEVELS = [100, 110, 120, 125, 130, 140, 150] as const;
/** The next size up (direction 1) or down (-1) from the current zoom; unchanged at either end. */
export function nextZoom(zoom: number, direction: 1 | -1): number {
  const levels: readonly number[] = ZOOM_LEVELS;
  const next = direction === 1 ? levels.find((z) => z > zoom) : levels.findLast((z) => z < zoom);
  return next ?? zoom;
}

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
  onStepInto?: () => void;
  onStepOut?: () => void;
  onPause?: () => void;
  /** Removes every breakpoint. */
  onClearBreakpoints?: () => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  theme: ThemeChoice;
  onTheme: (theme: ThemeChoice) => void;
  language?: PseudocodeLanguage;
  onLanguage?: (language: PseudocodeLanguage) => void;
  /** Save the active file; the button is disabled while this is missing. */
  onSave?: () => void;
  /** Open the converted program in a new tab. Missing in Simple mode (the converter is an Advanced tool). */
  onConvert?: ((target: "python") => void) | undefined;
  /** False when the active file is already Python, so there is nothing to convert to. */
  canConvert?: boolean;
  examples: readonly Example[];
  onExample: (example: Example) => void;
  /** Which tools are on (Settings and mode); every tool is on when missing. */
  tools?: ToolFlags;
}

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    {children}
  </svg>
);
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.4 } as const;
const NEXT_THEME = { system: "light", light: "dark", dark: "system" } as const;
const THEME_NAME = { system: "System", light: "Light", dark: "Dark" } as const;
const SOON = "Not available yet";

/**
 * Layout from the design: Run, Step, Continue, Reset | Clear breakpoints | Save, Convert to, then the Language and
 * Example selects and Theme on the right. Step into, Step out and Pause only appear while a program is running
 * (they have nothing to do otherwise); Save and Convert are shown disabled until they exist. Zoom is also in the
 * View menu.
 */
export function Toolbar(p: ToolbarProps) {
  const paused = p.paused === true;
  const tools = p.tools ?? ALL_TOOLS;
  return (
    <div className="sc-toolbar" role="toolbar" aria-label="Run controls">
      <button type="button" className="sc-tb" onClick={p.onRun} disabled={p.running || !p.canRun} title="Run (F5)">
        <Icon>
          <path d="M4 2.5v11l9-5.5z" style={{ fill: p.running || !p.canRun ? "currentColor" : "var(--green)" }} />
        </Icon>
        Run
      </button>
      {tools.breakpoints && (
        <button
          type="button"
          className="sc-tb"
          onClick={p.onStepOver}
          disabled={!paused && (p.running || !p.canRun)}
          title="Step over (F10)"
          aria-label="Step over"
        >
          <Icon>
            <path d="M2 9a6 6 0 0 1 11-3" style={stroke} />
            <path d="M14 3v4h-4z" style={{ fill: "currentColor" }} />
            <circle cx="8" cy="13" r="1.6" style={{ fill: "currentColor" }} />
          </Icon>
          Step
        </button>
      )}
      <button type="button" className="sc-tb" onClick={p.onContinue} disabled={!paused} title="Continue (F8)">
        <Icon>
          <rect x="2.5" y="3" width="2" height="10" style={{ fill: "currentColor" }} />
          <path d="M6.5 3v10l7-5z" style={{ fill: paused ? "var(--green)" : "currentColor" }} />
        </Icon>
        Continue
      </button>
      <button type="button" className="sc-tb" onClick={p.onStop} disabled={!p.running} title="Reset (Shift+F5)">
        <Icon>
          <rect x="3.5" y="3.5" width="9" height="9" style={{ fill: p.running ? "var(--red)" : "currentColor" }} />
        </Icon>
        Reset
      </button>
      {p.running && tools.stepInto && (
        <>
          <button type="button" className="sc-tb" onClick={p.onStepInto} disabled={!paused} title="Step into (F11)">
            <Icon>
              <path d="M8 2v9M4.5 7.5 8 11l3.5-3.5M3 14h10" style={stroke} />
            </Icon>
            Step into
          </button>
          <button type="button" className="sc-tb" onClick={p.onStepOut} disabled={!paused} title="Step out (Shift+F11)">
            <Icon>
              <path d="M8 11V2M4.5 5.5 8 2l3.5 3.5M3 14h10" style={stroke} />
            </Icon>
            Step out
          </button>
          <button type="button" className="sc-tb" onClick={p.onPause} disabled={paused} title="Pause">
            <Icon>
              <rect x="4" y="3" width="2.5" height="10" style={{ fill: "currentColor" }} />
              <rect x="9.5" y="3" width="2.5" height="10" style={{ fill: "currentColor" }} />
            </Icon>
            Pause
          </button>
        </>
      )}
      <span className="sc-sep" aria-hidden="true" />
      {tools.breakpoints && (
        <button type="button" className="sc-tb" onClick={p.onClearBreakpoints} title="Remove all breakpoints">
          <Icon>
            <circle cx="8" cy="8" r="4.5" style={{ fill: "none", stroke: "var(--red)", strokeWidth: 1.4 }} />
            <path d="M3 13L13 3" style={stroke} />
          </Icon>
          Clear breakpoints
        </button>
      )}
      <span className="sc-sep" aria-hidden="true" />
      <button
        type="button"
        className="sc-tb"
        disabled={p.onSave === undefined}
        title={p.onSave === undefined ? SOON : "Save (Ctrl+S)"}
        onClick={p.onSave}
      >
        <Icon>
          <path d="M2.5 2.5h9l2 2v9h-11zM5 2.5v3.5h5V2.5M4.5 13.5V9h7v4.5" style={{ ...stroke, strokeWidth: 1.3 }} />
        </Icon>
        Save
      </button>
      {p.onConvert !== undefined && tools.converter && (
        <label className="sc-field">
          Convert to
          <select
            aria-label="Convert to"
            value=""
            disabled={p.canConvert === false}
            title={p.canConvert === false ? "This file is already Python" : "Open a converted copy in a new tab"}
            onChange={(e) => {
              if (e.target.value === "python") p.onConvert?.("python");
            }}
          >
            <option value="" disabled>
              Choose…
            </option>
            <option value="python">Python</option>
          </select>
        </label>
      )}
      {p.language !== undefined && (
        <label className="sc-field sc-field-first">
          Language
          <select
            value={p.language}
            onChange={(e) => {
              const v = e.target.value;
              p.onLanguage?.(v === "cie" || v === "python" ? v : "edexcel");
            }}
          >
            <option value="edexcel">Edexcel pseudocode</option>
            <option value="cie">Cambridge 9618 pseudocode</option>
            <option value="python">Python</option>
          </select>
        </label>
      )}
      {tools.examples && (
        <label className="sc-field">
          Example
          <select
            value=""
            onChange={(e) => {
              const picked = p.examples.find((x) => x.id === e.target.value);
              if (picked !== undefined) p.onExample(picked);
            }}
          >
            <option value="">(untitled)</option>
            {p.examples.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        className="sc-tb sc-theme"
        onClick={() => {
          p.onTheme(NEXT_THEME[p.theme]);
        }}
        title={`Theme: ${THEME_NAME[p.theme]} (click for ${THEME_NAME[NEXT_THEME[p.theme]]})`}
      >
        <Icon>
          <circle cx="8" cy="8" r="5.5" style={{ ...stroke, strokeWidth: 1.3 }} />
          <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" style={{ fill: "currentColor" }} />
        </Icon>
        Theme
      </button>
      <span className="sc-sep" aria-hidden="true" />
      <button
        type="button"
        className="sc-tb"
        onClick={() => {
          p.onZoom(nextZoom(p.zoom, -1));
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
          p.onZoom(nextZoom(p.zoom, 1));
        }}
        disabled={p.zoom >= ZOOM_MAX}
        aria-label="A+ Zoom in"
        title="Zoom in"
      >
        A+
      </button>
    </div>
  );
}
