// The startup dialog: three steps (welcome, "not an official program", "don't let typing become a habit"). An
// in-page dialog like SaveDialog and SettingsDialog. Focus goes to the step title on open and on every step change,
// Tab is kept inside, and Escape closes it like "Start coding" but without ticking the box.
import { useEffect, useRef, useState } from "react";

import { BUG_EMAIL, BUG_MAILTO } from "./bug-report.ts";

export interface WelcomeDialogProps {
  /** `dontShowAgain` is the box's state; Escape always reports false. */
  onClose: (dontShowAgain: boolean) => void;
}

const FOCUSABLE = "button, a[href], input, [tabindex]:not([tabindex='-1'])";

export function WelcomeDialog({ onClose }: WelcomeDialogProps) {
  const [step, setStep] = useState(1);
  const [never, setNever] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  // Where focus was before the dialog opened, so it can go back there (the editor on a fresh launch).
  const opener = useRef<Element | null>(document.activeElement);
  useEffect(() => {
    title.current?.focus();
  }, [step]);
  useEffect(
    () => () => {
      const back = opener.current;
      if (back instanceof HTMLElement && back !== document.body && back.isConnected) back.focus();
      else document.querySelector<HTMLElement>(".cm-content")?.focus();
    },
    [],
  );
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose(false);
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
  const titles = ["Welcome to Sudocode", "This is not an official program", "Don't let typing become a habit"];
  return (
    <div className="sc-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="sc-welcome-title">
      <div className="sc-dialog sc-welcome" ref={box} onKeyDown={onKeyDown}>
        <p className="sc-hint sc-welcome-step">Step {step} of 3</p>
        <h2 id="sc-welcome-title" ref={title} tabIndex={-1}>
          {titles[step - 1]}
        </h2>
        {step === 1 && (
          <p>
            Use this program to deepen your understanding of logic and code by seeing what the code you write actually
            does. Run it, step through it, watch the variables change.
          </p>
        )}
        {step === 2 && (
          <>
            <p>
              Sudocode is not made by Cambridge (CIE) or Edexcel, so it may have bugs or behave differently from what an
              exam expects.
            </p>
            <p>
              Found a bug? Email <a href={BUG_MAILTO}>{BUG_EMAIL}</a>.
            </p>
            <p>
              Mark schemes are the source of truth, not this program. If Sudocode and a mark scheme disagree, trust the
              mark scheme.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <p>
              In your exam you have to write pseudocode by hand. Use this program to check your thinking, not to replace
              it. Try writing the answer on paper first, then run it here to see if you were right.
            </p>
            <p>Good luck, programmers.</p>
            <label className="sc-check">
              <input
                type="checkbox"
                checked={never}
                onChange={(e) => {
                  setNever(e.target.checked);
                }}
              />
              Don&rsquo;t show this again (you can find it in Help later)
            </label>
          </>
        )}
        <div className="sc-dialog-buttons">
          {step > 1 && (
            <button
              type="button"
              className="sc-tb"
              onClick={() => {
                setStep(step - 1);
              }}
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              className="sc-tb"
              onClick={() => {
                setStep(step + 1);
              }}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="sc-tb"
              onClick={() => {
                onClose(never);
              }}
            >
              Start coding
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
