// The right-hand panel: Problems, or the Debugger (Variables and the trace table), per docs/PRODUCT.md.
import type { Diagnostic, GuideSection, VirtualFiles } from "@sudocode/core";
import { FilesPanel } from "./FilesPanel.tsx";
import { CallStack } from "./CallStack.tsx";
import { QuickReference } from "./QuickReference.tsx";
import { Problems } from "./Problems.tsx";
import type { RunView } from "./run-state.ts";
import { TraceTable } from "./TraceTable.tsx";
import { Variables } from "./Variables.tsx";

export type SideTab = "problems" | "debugger" | "files" | "reference";

export interface SidePanelProps {
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  diagnostics: readonly Diagnostic[];
  onSelectProblem: (d: Diagnostic) => void;
  run: RunView;
  advanced: boolean;
  onAdvanced: (advanced: boolean) => void;
  /** Advanced mode only: shows the Files tab. */
  files?: FilesProps | undefined;
  /** Quick reference sections; the tab shows only when there are some. */
  guide?: readonly GuideSection[] | undefined;
  onUseGuide?: ((section: GuideSection) => void) | undefined;
}

export interface FilesProps {
  files: VirtualFiles;
  onChange: (name: string, contents: string) => void;
  onDelete: (name: string) => void;
}

export function SidePanel({
  tab,
  onTab,
  diagnostics,
  onSelectProblem,
  run,
  files,
  advanced,
  onAdvanced,
  guide,
  onUseGuide,
}: SidePanelProps) {
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
        {files !== undefined && tabButton("files", "Files")}
        {guide !== undefined && tabButton("reference", "Quick reference")}
        <label className="sc-mode">
          <input
            type="checkbox"
            checked={advanced}
            onChange={(e) => {
              onAdvanced(e.target.checked);
            }}
          />
          Advanced
        </label>
      </div>
      {tab === "reference" && guide !== undefined ? (
        <QuickReference sections={guide} onUse={(section) => onUseGuide?.(section)} />
      ) : tab === "files" && files !== undefined ? (
        <FilesPanel files={files.files} onChange={files.onChange} onDelete={files.onDelete} />
      ) : tab === "problems" ? (
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
          <section aria-label="Call stack" className="sc-stack-panel">
            <div className="sc-panel-title">
              <span>Call stack</span>
            </div>
            <CallStack stack={run.paused?.stack ?? []} />
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
