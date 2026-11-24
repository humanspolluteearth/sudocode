// The Problems list: every error, warning and note from the check worker. Clicking one jumps to its line.
import type { Diagnostic, Severity } from "@sudocode/core";
import { Section } from "./Section.tsx";

const KIND: Record<Severity, string> = { error: "Error", warning: "Warning", info: "Note" };

export interface ProblemsProps {
  diagnostics: readonly Diagnostic[];
  onSelect: (diagnostic: Diagnostic) => void;
}

export function Problems({ diagnostics, onSelect }: ProblemsProps) {
  return (
    <Section id="problems" title="Problems" count={String(diagnostics.length)} className="sc-problems-panel">
      {diagnostics.length === 0 ? (
        <div className="sc-empty">No problems.</div>
      ) : (
        <ul className="sc-problems">
          {diagnostics.map((d, i) => (
            <li key={`${d.code}-${String(d.line)}-${String(d.column)}-${String(i)}`}>
              <button
                type="button"
                className={`sc-problem ${d.severity}`}
                onClick={() => {
                  onSelect(d);
                }}
              >
                <span>
                  <span className={`kind-${d.severity}`}>{KIND[d.severity]}</span>
                  <span className="where">{`, line ${String(d.line)}: `}</span>
                  {d.message}
                </span>
                {d.hint !== "" && <span>{`Fix: ${d.hint}`}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
