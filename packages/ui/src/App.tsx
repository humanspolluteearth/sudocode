// The IDE's root component: toolbar, editor, console, side panel (Problems / Debugger) and status bar (layout
// from the prototype's desktop design, docs/PRODUCT.md). The shell passes in the worker factories, so this
// package never imports a worker.
import {
  CIE_EXAMPLES,
  CIE_GUIDE,
  EDEXCEL_EXAMPLES,
  PYTHON_EXAMPLES,
  PYTHON_GUIDE,
  type Diagnostic,
  type VirtualFiles,
} from "@sudocode/core";
import { useEffect, useReducer, useRef, useState } from "react";
import { createCheckClient, type CheckClient } from "./check-client.ts";
import { Console } from "./Console.tsx";
import { Editor, type EditorHandle } from "./Editor.tsx";
import { GuidePage, guideFromSearch, guideUrl, type GuideId } from "./GuidePage.tsx";
import { FileTabs } from "./FileTabs.tsx";
import { applyWrite, loadFiles, putFile, removeFile, saveFiles } from "./files-store.ts";
import { MenuBar } from "./MenuBar.tsx";
import { buildMenus } from "./menu-model.ts";
import { loadPreferences, savePreferences, type PseudocodeLanguage } from "./preferences.ts";
import { startRun, type RunSession, type SessionCommand, type WorkerFactories } from "./run-session.ts";
import { initialRunView, runReducer } from "./run-state.ts";
import { SidePanel, type SideTab } from "./SidePanel.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { StepLimitDialog } from "./StepLimitDialog.tsx";
import { Toolbar, type ThemeChoice } from "./Toolbar.tsx";
import "./styles.css";

const EXAMPLES = { edexcel: EDEXCEL_EXAMPLES, cie: CIE_EXAMPLES, python: PYTHON_EXAMPLES } as const;
// The app opens with the design's sample, the "Grade checker" example of the chosen language.
const starter = (language: PseudocodeLanguage): string => EXAMPLES[language].find((x) => x.id === "grade")?.code ?? "";
const STARTERS = { edexcel: starter("edexcel"), cie: starter("cie"), python: starter("python") } as const;
const GUIDES = { edexcel: undefined, cie: CIE_GUIDE, python: PYTHON_GUIDE } as const;
const LANGUAGE_NAMES = { edexcel: "Edexcel pseudocode", cie: "Cambridge 9618 pseudocode", python: "Python" } as const;

export interface AppProps {
  /** Without workers (tests, a bare page) the app shows the editor but Run stays disabled. */
  workers?: WorkerFactories;
}

export function App({ workers }: AppProps) {
  const [prefs, setPrefs] = useState(loadPreferences);
  const language = prefs.language;
  const [source, setSource] = useState<string>(STARTERS[prefs.language]);
  const [diagnostics, setDiagnostics] = useState<readonly Diagnostic[]>([]);
  const [run, dispatch] = useReducer(runReducer, initialRunView);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const [tab, setTab] = useState<SideTab>("debugger");
  // The full guide pages are routes (`?guide=cie`), so the browser's Back button and shared links work.
  const [guide, setGuide] = useState<GuideId | null>(() =>
    guideFromSearch(typeof location === "undefined" ? "" : location.search),
  );
  useEffect(() => {
    const onPop = () => {
      setGuide(guideFromSearch(globalThis.location.search));
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, []);
  const openGuide = (target: GuideId | "ide") => {
    globalThis.history.pushState(null, "", target === "ide" ? globalThis.location.pathname : guideUrl(target));
    setGuide(target === "ide" ? null : target);
  };
  const session = useRef<RunSession | null>(null);
  const checker = useRef<CheckClient | null>(null);
  const editor = useRef<EditorHandle>(null);
  // The student's virtual files: loaded from IndexedDB once, saved after every change. `filesRef` is what a run
  // starts with and what its fileWrite events update (state alone would be stale inside the run callback).
  const [files, setFilesState] = useState<VirtualFiles>({});
  const filesRef = useRef<VirtualFiles>({});
  const loaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setFiles = (next: VirtualFiles) => {
    filesRef.current = next;
    setFilesState(next);
    // Saved after a pause in typing, so each keystroke in the Files panel doesn't rewrite the database.
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      if (loaded.current) void saveFiles(filesRef.current);
    }, 300);
  };
  useEffect(() => {
    void loadFiles().then((stored) => {
      loaded.current = true;
      // Whatever a run wrote before the load finished wins over the stored copy of the same file.
      filesRef.current = { ...stored, ...filesRef.current };
      setFilesState(filesRef.current);
    });
  }, []);

  // The check worker lives as long as the editor.
  useEffect(() => {
    if (workers === undefined) return;
    const client = createCheckClient(workers.createCheckWorker(), language, setDiagnostics);
    checker.current = client;
    return () => {
      client.dispose();
      checker.current = null;
    };
  }, [workers, language]);
  useEffect(() => {
    checker.current?.request(source);
  }, [source, workers, language]);
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
      language,
      source,
      (event) => {
        if (event.type === "diagnostics") setDiagnostics(event.diagnostics);
        if (event.type === "fileWrite") setFiles(applyWrite(filesRef.current, event.name, event.contents));
        dispatch({ type: "event", event });
      },
      () => {
        session.current = null;
      },
      { breakpoints, trace, files: filesRef.current },
    );
  };
  const stop = () => session.current?.stop();
  const send = (command: SessionCommand) => session.current?.send(command);
  const resume = (command: "continue" | "stepOver" | "stepInto" | "stepOut") => {
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
    else if (e.key === "F11" && e.shiftKey) resume("stepOut");
    else if (e.key === "F11") resume("stepInto");
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
  const changeLanguage = (next: PseudocodeLanguage) => {
    // The old language's run and problems no longer apply.
    session.current?.stop();
    setDiagnostics([]);
    // An untouched starter program follows the language; anything the student wrote stays.
    if (source === STARTERS[language]) setSource(STARTERS[next]);
    if (tab === "reference" && next === "edexcel") setTab("debugger");
    update({ ...prefs, language: next });
  };
  const menus = buildMenus({
    running: active,
    paused: run.state === "paused",
    canRun: workers !== undefined,
    onRun: start,
    onStop: stop,
    onContinue: () => {
      resume("continue");
    },
    onStepOver: () => {
      resume("stepOver");
    },
    onStepInto: () => {
      resume("stepInto");
    },
    onStepOut: () => {
      resume("stepOut");
    },
    onPause: () => {
      send({ type: "pause" });
    },
    language,
    onLanguage: changeLanguage,
    zoom: prefs.zoom,
    onZoom: (zoom) => {
      update({ ...prefs, zoom });
    },
    theme: prefs.theme,
    onTheme: (theme) => {
      update({ ...prefs, theme });
    },
  });

  if (guide !== null) return <GuidePage guide={guide} onNavigate={openGuide} themeClass={themeClass(prefs.theme)} />;
  return (
    <div className={`sc-root ${themeClass(prefs.theme)}`} style={{ "--zoom": prefs.zoom / 100 } as React.CSSProperties}>
      <MenuBar menus={menus} />
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
        onStepInto={() => {
          resume("stepInto");
        }}
        onStepOut={() => {
          resume("stepOut");
        }}
        onPause={() => send({ type: "pause" })}
        onClearBreakpoints={() => editor.current?.clearBreakpoints()}
        zoom={prefs.zoom}
        onZoom={(zoom) => {
          update({ ...prefs, zoom });
        }}
        language={language}
        onLanguage={changeLanguage}
        examples={EXAMPLES[language]}
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
          <FileTabs language={language} name="untitled" source={source} />
          <Editor
            ref={editor}
            value={source}
            onChange={setSource}
            diagnostics={diagnostics}
            onBreakpointsChange={(lines) => {
              setBreakpoints(lines);
              send({ type: "setBreakpoints", lines });
            }}
            language={language}
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
          breakpoints={breakpoints}
          files={
            prefs.advanced
              ? {
                  files,
                  onChange: (name, contents) => {
                    setFiles(putFile(filesRef.current, name, contents));
                  },
                  onDelete: (name) => {
                    setFiles(removeFile(filesRef.current, name));
                  },
                }
              : undefined
          }
          guide={GUIDES[language]}
          language={language}
          onOpenGuide={openGuide}
          onUseGuide={(section) => {
            setSource(section.code);
          }}
          advanced={prefs.advanced}
          onAdvanced={(advanced) => {
            update({ ...prefs, advanced });
            if (!advanced && tab === "files") setTab("debugger");
          }}
        />
      </main>
      <StatusBar state={run.state} diagnostics={diagnostics} languageName={LANGUAGE_NAMES[language]} />
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
