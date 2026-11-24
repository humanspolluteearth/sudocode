// The console: what the program printed, a runtime error if it stopped with one, and an input on the last line while the
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
        {/* While the program waits, the input sits on the same line as the prompt it printed, like a terminal. */}
        {output !== "" && <pre className={`sc-out${waiting !== null ? " inline" : ""}`}>{output}</pre>}
        {waiting !== null && <InlineInput waiting={waiting} onInput={onInput} onCancel={onCancel} />}
        {error !== null && (
          <div className="sc-error">
            {`Error (line ${String(error.line)}): ${error.message}`}
            {error.hint !== "" && `\n${error.hint}`}
          </div>
        )}
        {finishedNote !== null && <div className="sc-hint">{finishedNote}</div>}
      </div>
    </section>
  );
}

interface InlineInputProps {
  waiting: InputWait;
  onInput: ((text: string) => void) | undefined;
  onCancel: (() => void) | undefined;
}

function InlineInput({ waiting, onInput, onCancel }: InlineInputProps) {
  const [text, setText] = useState("");
  const box = useRef<HTMLInputElement>(null);
  // The program is waiting: put the cursor on the line so the student can just type. Enter sends it, Esc cancels.
  useEffect(() => {
    box.current?.focus();
    box.current?.scrollIntoView({ block: "nearest" });
  }, [waiting]);
  const label = waiting.device === undefined ? "Input" : `Input from ${waiting.device}`;
  return (
    <input
      ref={box}
      className="sc-input-inline"
      aria-label={label}
      value={text}
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => {
        setText(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onInput?.(text);
          setText("");
        } else if (e.key === "Escape") onCancel?.();
      }}
    />
  );
}
