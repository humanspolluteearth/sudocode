// The IDE's root component: toolbar, editor, console, side panel (Problems / Debugger) and status bar (layout
// from the prototype's desktop design, docs/PRODUCT.md). The shell passes in the worker factories, so this
// package never imports a worker.
import { EDEXCEL_EXAMPLES, type Diagnostic } from "@sudocode/core";
import { useEffect, useReducer, useRef, useState } from "react";
import { createCheckClient, type CheckClient } from "./check-client.ts";
import { Console } from "./Console.tsx";
import { Editor, type EditorHandle } from "./Editor.tsx";
import { loadPreferences, savePreferences } from "./preferences.ts";
import { startRun, type RunSession, type SessionCommand, type WorkerFactories } from "./run-session.ts";
import { initialRunView, runReducer } from "./run-state.ts";
import { SidePanel, type SideTab } from "./SidePanel.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { StepLimitDialog } from "./StepLimitDialog.tsx";
import { Toolbar, type ThemeChoice } from "./Toolbar.tsx";
import "./styles.css";

const STARTER = 'SEND "Hello" TO DISPLAY\n';

export interface AppProps {
  /** Without workers (tests, a bare page) the app shows the editor but Run stays disabled. */
  workers?: WorkerFactories;
}

export function App({ workers }: AppProps) {
  const [source, setSource] = useState(STARTER);
  const [diagnostics, setDiagnostics] = useState<readonly Diagnostic[]>([]);
  const [run, dispatch] = useReducer(runReducer, initialRunView);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const [tab, setTab] = useState<SideTab>("problems");
  const session = useRef<RunSession | null>(null);
  const checker = useRef<CheckClient | null>(null);
  const [prefs, setPrefs] = useState(loadPreferences);
  const editor = useRef<EditorHandle>(null);

  // The check worker lives as long as the editor.
  useEffect(() => {
    if (workers === undefined) return;
    const client = createCheckClient(workers.createCheckWorker(), "edexcel", setDiagnostics);
    checker.current = client;
    return () => {
      client.dispose();
      checker.current = null;
    };
  }, [workers]);
  useEffect(() => {
    checker.current?.request(source);
  }, [source, workers]);
  useEffect(() => () => session.current?.stop(), []);

  // A pause at a breakpoint or after a step opens the Debugger, where the variables are.
  const pauseReason = run.paused?.reason;
  useEffect(() => {
    if (pauseReason !== undefined && pauseReason !== "stepLimit") setTab("debugger");
  }, [pauseReason]);

  const active = run.state === "running" || run.state === "paused" || run.state === "waiting";
  const start = () => {
    if (workers === undefined || session.current !== null) return;
    const trace = tab === "debugger"; // record only when the trace table is on screen (protocol.ts)
    dispatch({ type: "start", trace });
    session.current = startRun(
      workers.createRunWorker,
      "edexcel",
      source,
      (event) => {
        if (event.type === "diagnostics") setDiagnostics(event.diagnostics);
        dispatch({ type: "event", event });
      },
      () => {
        session.current = null;
      },
      { breakpoints, trace },
    );
  };
  const stop = () => session.current?.stop();
  const send = (command: SessionCommand) => session.current?.send(command);
  const resume = (command: "continue" | "stepOver") => {
    if (run.state !== "paused") return;
    dispatch({ type: "resumed" });
    send({ type: command });
  };

  // F5 Run (or Continue when paused), Shift+F5 Stop, F8 Continue, F10 Step over.
  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keys.current = (e) => {
    if (e.key === "F5" && e.shiftKey) stop();
    else if (e.key === "F5" && run.state === "paused") resume("continue");
    else if (e.key === "F5") start();
    else if (e.key === "F8") resume("continue");
    else if (e.key === "F10") resume("stepOver");
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      keys.current(e);
    };
    window.addEventListener("keydown", listener);
    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, []);

  const update = (next: typeof prefs) => {
    setPrefs(next);
    savePreferences(next);
  };
  const themeClass = (theme: ThemeChoice) => (theme === "system" ? "sys" : theme);
  const paused = run.paused;

  return (
    <div className={`sc-root ${themeClass(prefs.theme)}`} style={{ "--zoom": prefs.zoom / 100 } as React.CSSProperties}>
      <Toolbar
        running={active}
        paused={run.state === "paused"}
        canRun={workers !== undefined}
        onRun={start}
        onStop={stop}
        onContinue={() => {
          resume("continue");
        }}
        onStepOver={() => {
          resume("stepOver");
        }}
        onPause={() => send({ type: "pause" })}
        zoom={prefs.zoom}
        onZoom={(zoom) => {
          update({ ...prefs, zoom });
        }}
        examples={EDEXCEL_EXAMPLES}
        onExample={(example) => {
          setSource(example.code);
        }}
        theme={prefs.theme}
        onTheme={(theme) => {
          update({ ...prefs, theme });
        }}
      />
      <main className="sc-main">
        <div className="sc-left">
          <Editor
            ref={editor}
            value={source}
            onChange={setSource}
            diagnostics={diagnostics}
            onBreakpointsChange={(lines) => {
              setBreakpoints(lines);
              send({ type: "setBreakpoints", lines });
            }}
            pausedLine={paused === null || paused.reason === "stepLimit" ? null : paused.line}
          />
          <Console
            output={run.output}
            error={run.error}
            finishedNote={run.note}
            onClear={() => {
              dispatch({ type: "clearOutput" });
            }}
            waiting={run.waiting}
            onInput={(text) => {
              dispatch({ type: "typed", text });
              send({ type: "input", text });
            }}
            onCancel={stop}
          />
        </div>
        <SidePanel
          tab={tab}
          onTab={setTab}
          diagnostics={diagnostics}
          onSelectProblem={(d) => editor.current?.goTo(d.line, d.column)}
          run={run}
        />
      </main>
      <StatusBar state={run.state} diagnostics={diagnostics} languageName="Edexcel pseudocode" />
      {paused?.reason === "stepLimit" && (
        <StepLimitDialog
          line={paused.line}
          onContinue={() => {
            resume("continue");
          }}
          onStop={stop}
        />
      )}
    </div>
  );
}
