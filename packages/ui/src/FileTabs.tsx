// The file tab strip above the editor: one tab per open file (language badge, name, unsaved dot, close button),
// a "+" for a new file and the active file's line count. The tabs themselves live in workspace.ts.
import { useEffect, useRef, useState } from "react";
import { fileName, isDirty, type FileTab } from "./workspace.ts";

const BADGES = { edexcel: "EDX", cie: "CIE", python: "PY" } as const;

export function lineCount(source: string): number {
  if (source === "") return 1;
  const n = source.split("\n").length;
  return source.endsWith("\n") ? n - 1 : n;
}

export interface FileTabsProps {
  tabs: readonly FileTab[];
  activeId: number;
  onSwitch: (id: number) => void;
  onClose: (id: number) => void;
  onNew: () => void;
}

export function FileTabs({ tabs, activeId, onSwitch, onClose, onNew }: FileTabsProps) {
  const current = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const lines = lineCount(current?.source ?? "");
  const only = tabs.length === 1;
  const strip = useRef<HTMLDivElement>(null);
  // Which edges have more tabs hidden past them, so a fade can say "there are more".
  const [more, setMore] = useState({ left: false, right: false });
  useEffect(() => {
    const el = strip.current;
    if (el === null) return;
    const measure = () => {
      const left = el.scrollLeft > 1;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setMore((m) => (m.left === left && m.right === right ? m : { left, right }));
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [tabs.length]);
  // The active tab is always scrolled into view (a new tab, a switch, a window resize).
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    el?.parentElement?.parentElement?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeId, tabs.length]);
  return (
    <div className="sc-tabstrip">
      <div className="sc-tabs-wrap" data-more-left={more.left} data-more-right={more.right}>
        <div className="sc-tabs-scroll" ref={strip}>
          <div className="sc-tabs">
            {tabs.map((tab) => {
              const file = fileName(tab);
              const selected = tab.id === activeId;
              return (
                <div key={tab.id} className={`sc-tab${selected ? " sel" : ""}`}>
                  <div role="tablist" aria-label={`Open file ${file}`} className="sc-tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      className="sc-tab-btn"
                      title={file}
                      onClick={() => {
                        onSwitch(tab.id);
                      }}
                    >
                      <span className="sc-badge">{BADGES[tab.language]}</span>
                      {file}
                      {isDirty(tab) && (
                        <span className="sc-unsaved" role="img" aria-label="unsaved changes" title="Unsaved changes">
                          ●
                        </span>
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="sc-tab-close"
                    aria-label={`Close ${file}`}
                    title={only ? "The last open file can't be closed" : `Close ${file}`}
                    disabled={only}
                    onClick={() => {
                      onClose(tab.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <button type="button" className="sc-tab-new" aria-label="New tab" title="New file" onClick={onNew}>
        +
      </button>
      <span className="sc-linecount">{`${String(lines)} ${lines === 1 ? "line" : "lines"}`}</span>
    </div>
  );
}
