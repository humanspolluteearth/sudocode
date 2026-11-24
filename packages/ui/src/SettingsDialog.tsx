// Settings (docs/PRODUCT.md). Simple mode shows only theme and zoom; Advanced mode adds the mode switch and a
// checkbox for every tool, so each one can be switched off. An in-page dialog like SaveDialog.
import { useEffect, useRef } from "react";
import { TOOLS, type ToolId } from "./tools.ts";
import { ZOOM_LEVELS, type ThemeChoice } from "./Toolbar.tsx";

export interface SettingsDialogProps {
  advanced: boolean;
  onAdvanced: (advanced: boolean) => void;
  theme: ThemeChoice;
  onTheme: (theme: ThemeChoice) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  toolsOff: readonly ToolId[];
  onTool: (id: ToolId, on: boolean) => void;
  onClose: () => void;
}

const THEMES: [ThemeChoice, string][] = [
  ["system", "Match system"],
  ["light", "Light"],
  ["dark", "Dark"],
];

export function SettingsDialog(p: SettingsDialogProps) {
  const first = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  return (
    <div className="sc-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="sc-settings-title">
      <div
        className="sc-dialog"
        onKeyDown={(e) => {
          if (e.key === "Escape") p.onClose();
        }}
      >
        <h2 id="sc-settings-title">Settings</h2>
        <label className="sc-field">
          Theme
          <select
            ref={first}
            value={p.theme}
            onChange={(e) => {
              p.onTheme(THEMES.find(([id]) => id === e.target.value)?.[0] ?? "system");
            }}
          >
            {THEMES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="sc-field">
          Text size
          <select
            value={p.zoom}
            onChange={(e) => {
              p.onZoom(Number(e.target.value));
            }}
          >
            {ZOOM_LEVELS.map((z) => (
              <option key={z} value={z}>{`${String(z)}%`}</option>
            ))}
          </select>
        </label>
        {p.advanced ? (
          <fieldset className="sc-tools">
            <legend>Tools (untick to switch one off)</legend>
            {TOOLS.map((t) => (
              <label key={t.id} className="sc-check">
                <input
                  type="checkbox"
                  checked={!p.toolsOff.includes(t.id)}
                  onChange={(e) => {
                    p.onTool(t.id, e.target.checked);
                  }}
                />
                {t.label}
                {t.advancedOnly ? " (Advanced)" : ""}
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="sc-hint">More settings, and a switch for every tool, are in Advanced mode.</p>
        )}
        {p.advanced && (
          <label className="sc-check">
            <input
              type="checkbox"
              checked
              onChange={() => {
                p.onAdvanced(false);
              }}
            />
            Advanced mode
          </label>
        )}
        <div className="sc-dialog-buttons">
          <button type="button" className="sc-tb" onClick={p.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
