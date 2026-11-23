// The console: what the program printed, a runtime error if it stopped with one, and an input box while the
// program waits for a line (SH-05).
import type { Diagnostic } from "@sudocode/core";
import { useEffect, useRef, useState } from "react";

/** The program is waiting for a line. `device` is set for Edexcel devices other than KEYBOARD (EDX-74). */
export interface InputWait {
  prompt: string;
  device?: string;
}

export interface ConsoleProps {
  /** Everything the program has printed so far, as one string (newlines included). */
  output: string;
  /** The runtime error that ended the run, if any (SH-15 wording). */
  error: Diagnostic | null;
  /** True once a run has finished, stopped or failed: shows the "Program finished" line. */
  finishedNote: string | null;
  onClear: () => void;
  /** Set while the program waits for input: the console shows an input box. */
  waiting?: InputWait | null;
  /** The line the student typed, without a newline. */
  onInput?: (text: string) => void;
  /** Cancel at the input box ends the program (SH-05). */
  onCancel?: () => void;
}

export function Console({ output, error, finishedNote, onClear, waiting = null, onInput, onCancel }: ConsoleProps) {
  const log = useRef<HTMLDivElement>(null);
  // Keep the newest line in view as output arrives.
  useEffect(() => {
    const el = log.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [output, error]);
  const empty = output === "" && error === null && finishedNote === null;
  return (
    <section className="sc-console" aria-label="Console">
      <div className="sc-panel-title">
        <span>Console</span>
        <button type="button" className="sc-link" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="sc-console-log" role="log" aria-live="polite" ref={log} tabIndex={0}>
        {empty && <div className="sc-hint">Press Run to see your program&apos;s output here.</div>}
        {output !== "" && <pre className="sc-out">{output}</pre>}
        {error !== null && (
          <div className="sc-error">
            {`Error (line ${String(error.line)}): ${error.message}`}
            {error.hint !== "" && `\n${error.hint}`}
          </div>
        )}
        {finishedNote !== null && <div className="sc-hint">{finishedNote}</div>}
      </div>
      {waiting !== null && <InputBox waiting={waiting} onInput={onInput} onCancel={onCancel} />}
    </section>
  );
}

interface InputBoxProps {
  waiting: InputWait;
  onInput: ((text: string) => void) | undefined;
  onCancel: (() => void) | undefined;
}

function InputBox({ waiting, onInput, onCancel }: InputBoxProps) {
  const [text, setText] = useState("");
  const box = useRef<HTMLInputElement>(null);
  // The program is waiting: put the cursor in the box so the student can just type.
  useEffect(() => {
    box.current?.focus();
  }, [waiting]);
  const label = waiting.device === undefined ? "Input" : `Input from ${waiting.device}`;
  return (
    <form
      className="sc-input"
      onSubmit={(e) => {
        e.preventDefault();
        onInput?.(text);
        setText("");
      }}
    >
      <label>
        <span>{label}</span>
        <input
          ref={box}
          value={text}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel?.();
          }}
        />
      </label>
      <button type="submit" className="sc-tb">
        Enter
      </button>
      <button type="button" className="sc-tb" onClick={onCancel} title="Cancel (Esc) ends the program">
        Cancel
      </button>
    </form>
  );
}
