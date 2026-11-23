// The IDE's root component: toolbar, editor, console, problems and status bar (layout from the prototype's
// desktop design, docs/PRODUCT.md). Running and checking are wired in by later M3 items.
import type { Diagnostic } from "@sudocode/core";
import { useRef, useState } from "react";
import { Console } from "./Console.tsx";
import { Editor, type EditorHandle } from "./Editor.tsx";
import { Problems } from "./Problems.tsx";
import { loadPreferences, savePreferences } from "./preferences.ts";
import { StatusBar, type RunState } from "./StatusBar.tsx";
import { Toolbar, type ThemeChoice } from "./Toolbar.tsx";
import "./styles.css";

const STARTER = 'SEND "Hello" TO DISPLAY\n';

export function App() {
  const [source, setSource] = useState(STARTER);
  const [diagnostics] = useState<readonly Diagnostic[]>([]);
  const [output, setOutput] = useState("");
  const [error] = useState<Diagnostic | null>(null);
  const [state] = useState<RunState>("idle");
  const [prefs, setPrefs] = useState(loadPreferences);
  const editor = useRef<EditorHandle>(null);

  const update = (next: typeof prefs) => {
    setPrefs(next);
    savePreferences(next);
  };
  const themeClass = (theme: ThemeChoice) => (theme === "system" ? "sys" : theme);

  return (
    <div className={`sc-root ${themeClass(prefs.theme)}`} style={{ "--zoom": prefs.zoom / 100 } as React.CSSProperties}>
      <Toolbar
        running={state === "running"}
        canRun={false}
        onRun={() => undefined}
        onStop={() => undefined}
        zoom={prefs.zoom}
        onZoom={(zoom) => {
          update({ ...prefs, zoom });
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
            finishedNote={null}
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
