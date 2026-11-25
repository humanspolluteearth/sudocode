// Help > Author: who made Sudocode, how to reach them, and the "not an official program" notice. A small modal like
// WelcomeDialog: focus moves to the title, Tab stays inside, Escape or Close dismisses it and focus goes back to the
// Help menu button (the menu closes when an item is chosen, so the opener is gone by the time the dialog unmounts).
import { useEffect, useRef } from "react";

import { BUG_EMAIL, BUG_MAILTO } from "./bug-report.ts";

const FOCUSABLE = "button, a[href], input, [tabindex]:not([tabindex='-1'])";

export function AuthorDialog({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const opener = useRef<Element | null>(document.activeElement);
  useEffect(() => {
    title.current?.focus();
  }, []);
  useEffect(
    () => () => {
      const back = opener.current;
      if (back instanceof HTMLElement && back !== document.body && back.isConnected) back.focus();
      else document.querySelector<HTMLElement>('[data-menu="help"]')?.focus();
    },
    [],
  );
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab" && box.current !== null) {
      const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (first === undefined || last === undefined) return;
      if (e.shiftKey && (at === first || at === title.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  return (
    <div className="sc-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="sc-author-title">
      <div className="sc-dialog sc-welcome sc-author" ref={box} onKeyDown={onKeyDown}>
        <h2 id="sc-author-title" ref={title} tabIndex={-1}>
          Author
        </h2>
        <p>
          <strong>Mahmudul Hasan Sayeem</strong>
        </p>
        <p>
          Email <a href={BUG_MAILTO}>{BUG_EMAIL}</a>
        </p>
        <p>
          Sudocode is not made by Cambridge (CIE) or Edexcel, so it may have bugs or behave differently from what an
          exam expects. Mark schemes are the source of truth, not this program. If Sudocode and a mark scheme disagree,
          trust the mark scheme.
        </p>
        <div className="sc-dialog-buttons">
          <button type="button" className="sc-tb" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
