// The right-hand panel, as in the design: a Debugger tab (stacked Status, Problems, Variables, Call stack,
// Breakpoints and Trace table sections), a Quick reference tab, and a Files tab in Advanced mode.
import type { Diagnostic, GuideSection, VirtualFiles } from "@sudocode/core";
import { FilesPanel } from "./FilesPanel.tsx";
import { CallStack } from "./CallStack.tsx";
import type { GuideId } from "./GuidePage.tsx";
import { QuickReference } from "./QuickReference.tsx";
import { Problems } from "./Problems.tsx";
import type { RunView } from "./run-state.ts";
import { TraceTable } from "./TraceTable.tsx";
import { STATE_TEXT } from "./StatusBar.tsx";
import { Variables } from "./Variables.tsx";

export type SideTab = "debugger" | "files" | "reference";

export interface SidePanelProps {
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  diagnostics: readonly Diagnostic[];
  onSelectProblem: (d: Diagnostic) => void;
  run: RunView;
  /** The lines that have a breakpoint. */
  breakpoints: readonly number[];
  advanced: boolean;
  onAdvanced: (advanced: boolean) => void;
  /** Advanced mode only: shows the Files tab. */
  files?: FilesProps | undefined;
  /** Quick reference sections; the tab shows only when there are some. */
  guide?: readonly GuideSection[] | undefined;
  onUseGuide?: ((section: GuideSection) => void) | undefined;
  /** Which language's full guide the Quick reference links to. */
  language?: GuideId | undefined;
  onOpenGuide?: ((guide: GuideId) => void) | undefined;
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
  breakpoints,
  files,
  advanced,
  onAdvanced,
  guide,
  onUseGuide,
  language,
  onOpenGuide,
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
        <QuickReference
          sections={guide}
          onUse={(section) => onUseGuide?.(section)}
          language={language}
          onOpenGuide={onOpenGuide}
        />
      ) : tab === "files" && files !== undefined ? (
        <FilesPanel files={files.files} onChange={files.onChange} onDelete={files.onDelete} />
      ) : (
        <div className="sc-debugger" tabIndex={0} role="group" aria-label="Debugger">
          <section aria-label="Status" className="sc-status-panel">
            <div className="sc-panel-title">
              <span>Status</span>
            </div>
            <div className="sc-status-body">
              {STATE_TEXT[run.state]}
              {run.paused !== null && ` before line ${String(run.paused.line)}`}
            </div>
          </section>
          <Problems diagnostics={diagnostics} onSelect={onSelectProblem} />
          <section aria-label="Variables" className="sc-vars-panel">
            <div className="sc-panel-title">
              <span>Variables</span>
              {run.paused !== null && <span className="sc-count">{`line ${String(run.paused.line)}`}</span>}
            </div>
            <Variables frame={run.paused?.stack[0] ?? null} previous={run.previous} />
          </section>
          <section aria-label="Breakpoints" className="sc-bps-panel">
            <div className="sc-panel-title">
              <span>Breakpoints</span>
              <span className="sc-count">{breakpoints.length}</span>
            </div>
            <div className="sc-status-body">
              {breakpoints.length === 0 ? "No breakpoints." : breakpoints.map((n) => `line ${String(n)}`).join(", ")}
            </div>
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
