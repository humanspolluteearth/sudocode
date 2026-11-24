// The file tab strip above the editor: language badge, file name, close button, "+" and the line count.
// One program at a time for now, so close and "+" are shown disabled with a title rather than removed.
import type { PseudocodeLanguage } from "./preferences.ts";

const BADGES = { edexcel: "EDX", cie: "CIE", python: "PY" } as const;
const EXTENSIONS = { edexcel: "epc", cie: "cpc", python: "py" } as const;

export function lineCount(source: string): number {
  if (source === "") return 1;
  const n = source.split("\n").length;
  return source.endsWith("\n") ? n - 1 : n;
}

export function FileTabs({ language, name, source }: { language: PseudocodeLanguage; name: string; source: string }) {
  const lines = lineCount(source);
  const file = `${name}.${EXTENSIONS[language]}`;
  return (
    <div className="sc-tabstrip">
      <div className="sc-tabs">
        <div className="sc-tab sel">
          <div role="tablist" aria-label="Open files" className="sc-tablist">
            <button type="button" role="tab" aria-selected="true" className="sc-tab-btn" title={file}>
              <span className="sc-badge">{BADGES[language]}</span>
              {file}
            </button>
          </div>
          <button
            type="button"
            className="sc-tab-close"
            aria-label={`Close ${file}`}
            title="The last open file can't be closed"
            disabled
          >
            ×
          </button>
        </div>
      </div>
      <button
        type="button"
        className="sc-tab-new"
        aria-label="New tab"
        title="Several files at once isn't available yet"
        disabled
      >
        +
      </button>
      <span className="sc-linecount">{`${String(lines)} ${lines === 1 ? "line" : "lines"}`}</span>
    </div>
  );
}
