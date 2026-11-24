// The right-hand panel, as in the design: a Debugger tab (stacked Status, Problems, Variables, Call stack,
// Breakpoints and Trace table sections), a Quick reference tab, and a Files tab in Advanced mode.
import type { Diagnostic, VirtualFiles } from "@sudocode/core";
import { FilesPanel } from "./FilesPanel.tsx";
import { CallStack } from "./CallStack.tsx";
import type { GuideId } from "./GuidePage.tsx";
import { QuickReference } from "./QuickReference.tsx";
import { Problems } from "./Problems.tsx";
import type { RunView } from "./run-state.ts";
import { TraceTable } from "./TraceTable.tsx";
import { Section } from "./Section.tsx";
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
  /** Which language's Quick reference and full guide to show. */
  language: GuideId;
  /** Quick reference "Insert": type a sample at the editor's cursor. */
  onInsert: (code: string) => void;
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
  language,
  onInsert,
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
        {tabButton("reference", "Quick reference")}
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
      {tab === "reference" ? (
        <QuickReference language={language} onInsert={onInsert} onOpenGuide={onOpenGuide} />
      ) : tab === "files" && files !== undefined ? (
        <FilesPanel files={files.files} onChange={files.onChange} onDelete={files.onDelete} />
      ) : (
        <div className="sc-debugger" tabIndex={0} role="group" aria-label="Debugger">
          <Section id="status" title="Status" className="sc-status-panel">
            <div className="sc-pad">
              {STATE_TEXT[run.state]}
              {run.paused !== null && ` before line ${String(run.paused.line)}`}
            </div>
          </Section>
          <Problems diagnostics={diagnostics} onSelect={onSelectProblem} />
          <Section
            id="variables"
            title="Variables"
            count={run.paused !== null ? `line ${String(run.paused.line)}` : undefined}
            className="sc-vars-panel"
          >
            <Variables frame={run.paused?.stack[0] ?? null} previous={run.previous} />
          </Section>
          <Section
            id="breakpoints"
            defaultOpen={false}
            title="Breakpoints"
            count={String(breakpoints.length)}
            className="sc-bps-panel"
          >
            <div className="sc-pad">
              {breakpoints.length === 0 ? "No breakpoints." : breakpoints.map((n) => `line ${String(n)}`).join(", ")}
            </div>
          </Section>
          <Section id="callstack" defaultOpen={false} title="Call stack" className="sc-stack-panel">
            <CallStack stack={run.paused?.stack ?? []} />
          </Section>
          <Section id="trace" defaultOpen={false} title="Trace table" className="sc-trace-panel">
            <TraceTable rows={run.trace} recorded={run.traceRecorded} />
          </Section>
        </div>
      )}
    </aside>
  );
}
