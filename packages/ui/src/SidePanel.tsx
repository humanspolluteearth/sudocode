// The right-hand panel: Problems, or the Debugger (Variables and the trace table), per docs/PRODUCT.md.
import type { Diagnostic } from "@sudocode/core";
import { Problems } from "./Problems.tsx";
import type { RunView } from "./run-state.ts";
import { TraceTable } from "./TraceTable.tsx";
import { Variables } from "./Variables.tsx";

export type SideTab = "problems" | "debugger";

export interface SidePanelProps {
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  diagnostics: readonly Diagnostic[];
  onSelectProblem: (d: Diagnostic) => void;
  run: RunView;
}

export function SidePanel({ tab, onTab, diagnostics, onSelectProblem, run }: SidePanelProps) {
  const tabButton = (id: SideTab, label: string) => (
    <button
      type="button"
      className={`sc-tab${tab === id ? " on" : ""}`}
      aria-pressed={tab === id}
      onClick={() => {
        onTab(id);
      }}
    >
      {label}
    </button>
  );
  return (
    <aside className="sc-side" aria-label="Side panel">
      <div className="sc-tabs" role="group" aria-label="Side panel view">
        {tabButton("problems", "Problems")}
        {tabButton("debugger", "Debugger")}
      </div>
      {tab === "problems" ? (
        <Problems diagnostics={diagnostics} onSelect={onSelectProblem} />
      ) : (
        <div className="sc-debugger">
          <section aria-label="Variables" className="sc-vars-panel">
            <div className="sc-panel-title">
              <span>Variables</span>
              {run.paused !== null && <span className="sc-count">{`line ${String(run.paused.line)}`}</span>}
            </div>
            <Variables frame={run.paused?.stack[0] ?? null} previous={run.previous} />
          </section>
          <section aria-label="Trace table" className="sc-trace-panel">
            <div className="sc-panel-title">
              <span>Trace table</span>
            </div>
            <TraceTable rows={run.trace} recorded={run.traceRecorded} />
          </section>
        </div>
      )}
    </aside>
  );
}
