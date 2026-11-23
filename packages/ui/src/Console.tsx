// The console: what the program printed, plus a runtime error if it stopped with one.
import type { Diagnostic } from "@sudocode/core";
import { useEffect, useRef } from "react";

export interface ConsoleProps {
  /** Everything the program has printed so far, as one string (newlines included). */
  output: string;
  /** The runtime error that ended the run, if any (SH-15 wording). */
  error: Diagnostic | null;
  /** True once a run has finished, stopped or failed: shows the "Program finished" line. */
  finishedNote: string | null;
  onClear: () => void;
}

export function Console({ output, error, finishedNote, onClear }: ConsoleProps) {
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
    </section>
  );
}
