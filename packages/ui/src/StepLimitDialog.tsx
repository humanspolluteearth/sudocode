// SH-14: after 10 million steps the program pauses and asks whether to keep going (it may be an infinite loop).
// An in-page dialog, not window.confirm, so the page and the worker stay responsive.
import { useEffect, useRef } from "react";

export interface StepLimitDialogProps {
  line: number;
  onContinue: () => void;
  onStop: () => void;
}

export function StepLimitDialog({ line, onContinue, onStop }: StepLimitDialogProps) {
  const keepGoing = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    keepGoing.current?.focus();
  }, []);
  return (
    <div className="sc-dialog-backdrop">
      <div
        className="sc-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sc-steplimit-title"
        aria-describedby="sc-steplimit-text"
      >
        <h2 id="sc-steplimit-title">Still running</h2>
        <p id="sc-steplimit-text">
          {`Your program has run 10 million steps and is now at line ${String(line)}. It may be stuck in a loop that never ends. Keep going?`}
        </p>
        <div className="sc-dialog-buttons">
          <button type="button" className="sc-tb" ref={keepGoing} onClick={onContinue}>
            Keep going
          </button>
          <button type="button" className="sc-tb" onClick={onStop}>
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}
