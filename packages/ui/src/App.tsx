// The IDE's root component: toolbar, editor, console, problems and status bar (layout from the prototype's
// desktop design, docs/PRODUCT.md). The shell passes in the worker factories, so this package never imports a worker.
import { EDEXCEL_EXAMPLES, type Diagnostic, type RunnerEvent } from "@sudocode/core";
import { useEffect, useRef, useState } from "react";
import { createCheckClient, type CheckClient } from "./check-client.ts";
import { Console } from "./Console.tsx";
import { Editor, type EditorHandle } from "./Editor.tsx";
import { Problems } from "./Problems.tsx";
import { startRun, type RunSession, type WorkerFactories } from "./run-session.ts";
import { loadPreferences, savePreferences } from "./preferences.ts";
import { StatusBar, type RunState } from "./StatusBar.tsx";
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
  const [output, setOutput] = useState("");
  const [error, setError] = useState<Diagnostic | null>(null);
  const [state, setState] = useState<RunState>("idle");
  const [note, setNote] = useState<string | null>(null);
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

  const onEvent = (event: RunnerEvent) => {
    if (event.type === "output") setOutput((o) => o + event.text);
    else if (event.type === "error") setError(event.diagnostic);
    else if (event.type === "diagnostics") setDiagnostics(event.diagnostics);
    else if (event.type === "done") {
      setState(event.status === "finished" ? "finished" : event.status);
      setNote(event.status === "stopped" ? "Stopped." : event.status === "finished" ? "Finished." : null);
    }
  };
  const run = () => {
    if (workers === undefined || session.current !== null) return;
    setOutput("");
    setError(null);
    setNote(null);
    setState("running");
    session.current = startRun(workers.createRunWorker, "edexcel", source, onEvent, () => {
      session.current = null;
    });
  };
  const stop = () => {
    session.current?.stop();
  };

  const update = (next: typeof prefs) => {
    setPrefs(next);
    savePreferences(next);
  };
  const themeClass = (theme: ThemeChoice) => (theme === "system" ? "sys" : theme);

  return (
    <div className={`sc-root ${themeClass(prefs.theme)}`} style={{ "--zoom": prefs.zoom / 100 } as React.CSSProperties}>
      <Toolbar
        running={state === "running"}
        canRun={workers !== undefined}
        onRun={run}
        onStop={stop}
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
          <Editor ref={editor} value={source} onChange={setSource} diagnostics={diagnostics} />
          <Console
            output={output}
            error={error}
            finishedNote={note}
            onClear={() => {
              setOutput("");
            }}
          />
        </div>
        <aside className="sc-side" aria-label="Side panel">
          <Problems diagnostics={diagnostics} onSelect={(d) => editor.current?.goTo(d.line, d.column)} />
        </aside>
      </main>
      <StatusBar state={state} diagnostics={diagnostics} languageName="Edexcel pseudocode" />
    </div>
  );
}
