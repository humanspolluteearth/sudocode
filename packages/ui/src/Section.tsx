// A debugger section: a title bar that is a button, so the body can be folded away (arrow keys not needed: Tab, then
// Enter or Space). Whether each section is open is remembered in this browser only, as a convenience.
import { useState, type ReactNode } from "react";

const KEY = "sudocode.collapsed";

function loadCollapsed(): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveCollapsed(ids: readonly string[]): void {
  try {
    globalThis.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Storage can be blocked (private window); the section still works for this visit.
  }
}

export interface SectionProps {
  /** Stable id, used to remember the open/closed state. */
  id: string;
  title: string;
  /** Small muted text after the title (a count, a line number). */
  count?: string | undefined;
  className?: string;
  children: ReactNode;
}

export function Section({ id, title, count, className = "", children }: SectionProps) {
  const [closed, setClosed] = useState(() => loadCollapsed().includes(id));
  const toggle = () => {
    const next = !closed;
    setClosed(next);
    const rest = loadCollapsed().filter((x) => x !== id);
    saveCollapsed(next ? [...rest, id] : rest);
  };
  return (
    <section aria-label={title} className={`sc-section ${closed ? "closed" : ""} ${className}`}>
      <button type="button" className="sc-panel-title sc-section-head" aria-expanded={!closed} onClick={toggle}>
        <span className="sc-chevron" aria-hidden="true">
          {closed ? "▸" : "▾"}
        </span>
        <span>{title}</span>
        {count !== undefined && <span className="sc-count">{count}</span>}
      </button>
      {!closed && <div className="sc-section-body">{children}</div>}
    </section>
  );
}
