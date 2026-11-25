// The extra controls of the compact layout (design: Tablet.dc.html, Mobile.dc.html): a bottom view switcher, the
// "Insert keyword" key bar, the "1 problem" chip and the "File and convert actions" overflow menu.
import { CONVERT_TARGETS } from "./convert-targets.ts";
import type { Diagnostic } from "@sudocode/core";
import { useState } from "react";
import { KEYSETS, type CompactView } from "./compact.ts";
import type { PseudocodeLanguage } from "./preferences.ts";

/** The text sizes the design offers on a small screen. */
const TEXT_SIZES = [100, 110, 125, 150] as const;

const VIEWS: readonly { id: CompactView; label: string }[] = [
  { id: "code", label: "Code" },
  { id: "console", label: "Console" },
  { id: "debug", label: "Debug" },
  { id: "guide", label: "Guide" },
];

export function ViewSwitcher(p: { view: CompactView; onView: (v: CompactView) => void; problems: number }) {
  return (
    <nav className="sc-views" aria-label="Views">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          className="sc-view"
          aria-current={p.view === v.id ? "page" : undefined}
          onClick={() => {
            p.onView(v.id);
          }}
        >
          {v.label}
          {v.id === "debug" && p.problems > 0 && (
            <span
              className="sc-dot"
              role="img"
              aria-label={`${String(p.problems)} ${p.problems === 1 ? "problem" : "problems"}`}
            />
          )}
        </button>
      ))}
    </nav>
  );
}

/** One tap per keyword: pressing a key must not steal focus from the editor, so mousedown is cancelled. */
export function KeyBar(p: { language: PseudocodeLanguage; onInsert: (text: string) => void }) {
  return (
    <div role="toolbar" aria-label="Insert keyword" className="sc-keybar on">
      {KEYSETS[p.language].map((k) => (
        <button
          key={k}
          type="button"
          className="sc-key"
          aria-label={k === "\t" ? "Insert indent" : `Insert ${k}`}
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          onClick={() => {
            p.onInsert(k === "\t" ? "    " : k);
          }}
        >
          {k === "\t" ? "⇥" : k}
        </button>
      ))}
    </div>
  );
}

export function ProblemChip(p: { diagnostics: readonly Diagnostic[]; onOpen: (d: Diagnostic) => void }) {
  const first = p.diagnostics[0];
  if (first === undefined) return null;
  return (
    <button
      type="button"
      className="sc-chip"
      onClick={() => {
        p.onOpen(first);
      }}
    >
      <span className="sc-chip-line">Line {first.line}: </span>
      {first.message}
      <span className="sc-chip-more">Details</span>
    </button>
  );
}

export interface OverflowProps {
  onNew: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  /** Present only when the converter is on and the language can be converted. */
  onConvert?: ((to: PseudocodeLanguage) => void) | undefined;
  /** The active file's language, so only the other two targets are listed. */
  language?: PseudocodeLanguage;
  onCloseTab: () => void;
  canCloseTab: boolean;
  zoom: number;
  onZoom: (zoom: number) => void;
}

/**
 * Tablet toolbar button that hides or shows the side panel. `attention` is the small dot shown while the panel is
 * hidden and something happened in it (a pause or an error): hiding the panel is the student's choice, so the app
 * never reopens it, it only says there is something to look at.
 */
export function SidePanelToggle(p: { shown: boolean; attention: boolean; onToggle: () => void }) {
  const title = p.shown ? "Hide side panel" : "Show side panel";
  return (
    <button
      type="button"
      className="sc-tb sc-keep sc-side-toggle"
      aria-pressed={p.shown}
      title={title}
      onClick={p.onToggle}
    >
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
        <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect
          x="11"
          y="3.5"
          width="6.5"
          height="13"
          fill={p.shown ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <span className="sc-sr-only">{title}</span>
      {p.attention && !p.shown && (
        <>
          <span className="sc-side-dot" aria-hidden="true" />
          <span className="sc-sr-only" role="status">
            The program paused or stopped with an error. Show the side panel to see it.
          </span>
        </>
      )}
    </button>
  );
}

export function OverflowMenu(p: OverflowProps) {
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  return (
    <div className="sc-more">
      <button
        type="button"
        className="sc-tb"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="File and convert actions"
        onClick={() => {
          setOpen(!open);
        }}
      >
        ⋯
      </button>
      {open && (
        <div role="menu" aria-label="File and convert actions" className="sc-more-menu">
          <button type="button" role="menuitem" onClick={run(p.onNew)}>
            New tab
          </button>
          <button type="button" role="menuitem" onClick={run(p.onSave)}>
            Save
          </button>
          <button type="button" role="menuitem" onClick={run(p.onSaveAs)}>
            Save as…
          </button>
          {p.onConvert !== undefined &&
            CONVERT_TARGETS.filter((t) => t.id !== p.language).map((t) => (
              <button key={t.id} type="button" role="menuitem" onClick={run(() => p.onConvert?.(t.id))}>
                Convert to {t.label}
              </button>
            ))}
          <button type="button" role="menuitem" disabled={!p.canCloseTab} onClick={run(p.onCloseTab)}>
            Close tab
          </button>
          <div role="group" aria-label="Text size">
            {TEXT_SIZES.map((z) => (
              <button
                key={z}
                type="button"
                role="menuitemradio"
                aria-checked={p.zoom === z}
                onClick={run(() => {
                  p.onZoom(z);
                })}
              >
                Text size {z}%
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
