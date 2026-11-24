// A debugger section: a title bar that is a button, so the body can be folded away (arrow keys not needed: Tab, then
// Enter or Space). Whether each section is open is remembered in this browser only, as a convenience.
import { useState, type ReactNode } from "react";

const KEY = "sudocode.sections";

/** Which sections the student has opened (true) or folded (false); a section not in here uses its default. */
function loadOpen(): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage.getItem(KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === "boolean"));
  } catch {
    return {};
  }
}

function saveOpen(id: string, open: boolean): void {
  try {
    globalThis.localStorage.setItem(KEY, JSON.stringify({ ...loadOpen(), [id]: open }));
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
  /** Whether it starts open (default true); a choice the student made earlier wins. */
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export function Section({ id, title, count, defaultOpen = true, className = "", children }: SectionProps) {
  const [closed, setClosed] = useState(() => !(loadOpen()[id] ?? defaultOpen));
  const toggle = () => {
    setClosed(!closed);
    saveOpen(id, closed);
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
