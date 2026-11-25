// The IDE's root component: toolbar, editor, console, side panel (Problems / Debugger) and status bar (layout
// from the prototype's desktop design, docs/PRODUCT.md). The shell passes in the worker factories, so this
// package never imports a worker.
import { type Diagnostic, type VirtualFiles } from "@sudocode/core";
import { lazy, Suspense, useEffect, useReducer, useRef, useState } from "react";
import { createCheckClient, type CheckClient } from "./check-client.ts";
import { Console } from "./Console.tsx";
import { KeyBar, OverflowMenu, ProblemChip, SidePanelToggle, ViewSwitcher } from "./CompactChrome.tsx";
import { useLayout, type CompactView } from "./compact.ts";
import { Editor, type EditorHandle } from "./Editor.tsx";
import { GuidePage, guideFromSearch, guideUrl, type GuideId } from "./GuidePage.tsx";
import { toolFlags } from "./tools.ts";
import { useWorkspace } from "./use-workspace.ts";
import { FileTabs } from "./FileTabs.tsx";
import { applyWrite, loadFiles, putFile, removeFile, saveFiles } from "./files-store.ts";
import { MenuBar } from "./MenuBar.tsx";
import { buildMenus } from "./menu-model.ts";
import { loadPreferences, savePreferences, type PseudocodeLanguage } from "./preferences.ts";
import { startRun, type RunSession, type SessionCommand, type WorkerFactories } from "./run-session.ts";
import { initialRunView, runReducer } from "./run-state.ts";
import { SidePanel, type SideTab } from "./SidePanel.tsx";
import { NoteBanner, type Note } from "./NoteBanner.tsx";
import { StatusBar, type CursorPosition } from "./StatusBar.tsx";
import { Splitter } from "./Splitter.tsx";
import { usePaneSize } from "./use-pane-size.ts";
import { BUG_MAILTO } from "./bug-report.ts";
import { StepLimitDialog } from "./StepLimitDialog.tsx";
import { nextZoom, Toolbar, ZOOM_LEVELS, type ThemeChoice } from "./Toolbar.tsx";
import "./styles.css";

// The app opens with a blank untitled file in the remembered language (no sample program).
// Dialogs are only needed when opened, so they load on demand and stay out of the first download (the 2 GB device target).
const SettingsDialog = lazy(() => import("./SettingsDialog.tsx").then((m) => ({ default: m.SettingsDialog })));
const AuthorDialog = lazy(() => import("./AuthorDialog.tsx").then((m) => ({ default: m.AuthorDialog })));
const WelcomeDialog = lazy(() => import("./WelcomeDialog.tsx").then((m) => ({ default: m.WelcomeDialog })));
const SaveDialog = lazy(() => import("./SaveDialog.tsx").then((m) => ({ default: m.SaveDialog })));

const LANGUAGE_NAMES = { edexcel: "Edexcel pseudocode", cie: "Cambridge 9618 pseudocode", python: "Python" } as const;

export interface AppProps {
  /** Without workers (tests, a bare page) the app shows the editor but Run stays disabled. */
  workers?: WorkerFactories;
}

export function App({ workers }: AppProps) {
  const [prefs, setPrefs] = useState(loadPreferences);
  const [diagnostics, setDiagnostics] = useState<readonly Diagnostic[]>([]);
  const [run, dispatch] = useReducer(runReducer, initialRunView);
  // A note under the tab strip; nothing sets one yet (see NoteBanner), so it starts empty.
  const [note, setNote] = useState<Note | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The startup dialog shows on every launch until "Don't show this again" was ticked; Help reopens it.
  const [authorOpen, setAuthorOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !loadPreferences().welcomeDone);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const [cursor, setCursor] = useState<CursorPosition>({ line: 1, column: 1 });
  const [tab, setTab] = useState<SideTab>("debugger");
  const [sideWidth, setSideWidth] = usePaneSize("sudocode.side-w", 340, 220, 720);
  const [consoleHeight, setConsoleHeight] = usePaneSize("sudocode.console-h", 210, 80, 600);
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
  // The open files. Switching file or opening a converted copy ends any run and clears breakpoints (they belong
  // to the file they were set in).
  const files$ = useWorkspace(
    { language: prefs.language, source: "" },
    () => {
      session.current?.stop();
      setDiagnostics([]);
      editor.current?.clearBreakpoints();
    },
    setNote,
  );
  const { current } = files$;
  const { source, language } = current;
  const setSource = files$.setSource;
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

  // Step with no run going starts one that stops before the first statement, so a teacher can walk through every
  // line without a breakpoint. The engine's "pause" request is honoured at the next statement, which is the first.
  const step = (command: "stepOver" | "stepInto") => {
    if (run.state === "paused") resume(command);
    else if (!active && workers !== undefined) {
      start();
      send({ type: "pause" });
    }
  };

  // F5 Run (or Continue when paused), Shift+F5 Stop, F8 Continue, F10 Step over.
  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keys.current = (e) => {
    if (e.key === "F5" && e.shiftKey) stop();
    else if (e.key === "F5" && run.state === "paused") resume("continue");
    else if (e.key === "F5") start();
    else if (e.key === "F8") resume("continue");
    else if (e.key === "F10") step("stepOver");
    else if (e.key === "F11" && e.shiftKey) resume("stepOut");
    else if (e.key === "F11") step("stepInto");
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      if (e.shiftKey) files$.saveAs();
      else files$.save();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+"))
      update({ ...prefs, zoom: nextZoom(prefs.zoom, 1) });
    else if ((e.ctrlKey || e.metaKey) && e.key === "-") update({ ...prefs, zoom: nextZoom(prefs.zoom, -1) });
    else if ((e.ctrlKey || e.metaKey) && e.key === "0") update({ ...prefs, zoom: ZOOM_LEVELS[0] });
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
  const tools = toolFlags(prefs.advanced, prefs.toolsOff);
  const themeClass = (theme: ThemeChoice) => (theme === "system" ? "sys" : theme);
  const paused = run.paused;
  const changeLanguage = (next: PseudocodeLanguage) => {
    // The old language's run and problems no longer apply.
    session.current?.stop();
    setDiagnostics([]);
    files$.setLanguage(next);
    update({ ...prefs, language: next });
  };
  const { compact, phone, tablet, keyBar } = useLayout();
  const [view, setView] = useState<CompactView>("code");
  // On a phone only one view shows, so when a run waits for input or ends, move to the Console where the output is.
  const phoneRef = useRef(phone);
  phoneRef.current = phone;
  useEffect(() => {
    if (phoneRef.current && (run.state === "waiting" || run.state === "finished" || run.state === "error")) {
      setView("console");
    }
  }, [run.state]);
  // Tablet side panel: hidden by choice (remembered). A pause, breakpoint or error while it is hidden never reopens
  // it; `sideAttention` lights a dot on the toggle until the student shows the panel.
  const sideHidden = tablet && prefs.sidePanelHidden;
  const [sideAttention, setSideAttention] = useState(false);
  useEffect(() => {
    const needsLook = (pauseReason !== undefined && pauseReason !== "stepLimit") || run.state === "error";
    if (!sideHidden) setSideAttention(false);
    else if (needsLook) setSideAttention(true);
  }, [sideHidden, pauseReason, run.state]);
  const toggleSidePanel = () => {
    update({ ...prefs, sidePanelHidden: !prefs.sidePanelHidden });
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
      step("stepOver");
    },
    onStepInto: () => {
      step("stepInto");
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
    sideTab: tab,
    onSideTab: setTab,
    onClearConsole: () => {
      dispatch({ type: "clearOutput" });
    },
    breakpointCount: breakpoints.length,
    onClearBreakpoints: () => editor.current?.clearBreakpoints(),
    onNewFile: files$.newFile,
    onOpenFile: files$.openFiles,
    onSave: files$.save,
    onSaveAs: files$.saveAs,
    onSaveAll: files$.saveAll,
    advanced: prefs.advanced,
    onConvertToPython: files$.convertToPython,
    tools,
    onSettings: () => {
      setSettingsOpen(true);
    },
    ...(tablet ? { onToggleSidePanel: toggleSidePanel, sidePanelShown: !sideHidden } : {}),
    onWelcome: () => {
      setWelcomeOpen(true);
    },
    onReportBug: () => {
      globalThis.location.href = BUG_MAILTO;
    },
    onAuthor: () => {
      setAuthorOpen(true);
    },
  });

  if (guide !== null) return <GuidePage guide={guide} onNavigate={openGuide} themeClass={themeClass(prefs.theme)} />;
  return (
    <div
      className={`sc-root ${themeClass(prefs.theme)}${compact ? " sc-compact" : ""}${tablet ? " sc-tablet" : ""}`}
      data-view={phone ? view : undefined}
      style={{ "--zoom": prefs.zoom / 100 } as React.CSSProperties}
    >
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
          step("stepOver");
        }}
        onStepInto={() => {
          step("stepInto");
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
        onSave={files$.save}
        onConvert={
          prefs.advanced && tools.converter
            ? () => {
                files$.convertToPython();
              }
            : undefined
        }
        canConvert={language !== "python"}
        extra={
          compact ? (
            <>
              <OverflowMenu
                onNew={files$.newFile}
                onSave={files$.save}
                onSaveAs={files$.saveAs}
                onConvert={
                  prefs.advanced && tools.converter && language !== "python" ? files$.convertToPython : undefined
                }
                onCloseTab={() => {
                  files$.close(files$.ws.activeId);
                }}
                canCloseTab={files$.ws.tabs.length > 1}
                zoom={prefs.zoom}
                onZoom={(zoom) => {
                  update({ ...prefs, zoom });
                }}
              />
              {tablet && <SidePanelToggle shown={!sideHidden} attention={sideAttention} onToggle={toggleSidePanel} />}
            </>
          ) : undefined
        }
        tools={tools}
        theme={prefs.theme}
        onTheme={(theme) => {
          update({ ...prefs, theme });
        }}
      />
      <main
        className={`sc-main${sideHidden ? " sc-side-hidden" : ""}`}
        style={{ "--side-w": `${String(sideWidth)}px` } as React.CSSProperties}
      >
        <div className="sc-left" style={{ "--console-h": `${String(consoleHeight)}px` } as React.CSSProperties}>
          <FileTabs
            tabs={files$.ws.tabs}
            activeId={files$.ws.activeId}
            onSwitch={files$.switchTo}
            onClose={files$.close}
            onNew={files$.newFile}
          />
          {note !== null && (
            <NoteBanner
              note={note}
              onDismiss={() => {
                setNote(null);
              }}
            />
          )}
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
            onCursorChange={setCursor}
            breakpointsEnabled={tools.breakpoints}
            pausedLine={paused === null || paused.reason === "stepLimit" ? null : paused.line}
          />
          <Splitter orientation="horizontal" label="Resize console" size={consoleHeight} onResize={setConsoleHeight} />
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
        <Splitter orientation="vertical" label="Resize side panel" size={sideWidth} onResize={setSideWidth} />
        <SidePanel
          tab={tab}
          onTab={setTab}
          diagnostics={diagnostics}
          onSelectProblem={(d) => editor.current?.goTo(d.line, d.column)}
          run={run}
          breakpoints={breakpoints}
          tools={tools}
          files={
            tools.files
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
          language={language}
          onOpenGuide={openGuide}
          onInsert={(code) => {
            editor.current?.insertAtCursor(code);
            if (phoneRef.current) setView("code");
          }}
          advanced={prefs.advanced}
          onAdvanced={(advanced) => {
            update({ ...prefs, advanced });
            if (!advanced && tab === "files") setTab("debugger");
          }}
        />
      </main>
      {compact && (
        <ProblemChip
          diagnostics={diagnostics}
          onOpen={(d) => {
            setView("code");
            editor.current?.goTo(d.line, d.column);
          }}
        />
      )}
      {keyBar && <KeyBar language={language} onInsert={(text) => editor.current?.insertAtCursor(text)} />}
      {phone && (
        <ViewSwitcher
          view={view}
          onView={(v) => {
            // The Guide view is the Quick reference tab; its link opens the full guide page.
            if (v === "guide") setTab("reference");
            else if (v === "debug" && tab === "reference") setTab("debugger");
            setView(v);
          }}
          problems={diagnostics.length}
        />
      )}
      <StatusBar
        state={run.state}
        line={run.state === "error" ? (run.error?.line ?? null) : (run.paused?.line ?? null)}
        cursor={cursor}
        diagnostics={diagnostics}
        languageName={LANGUAGE_NAMES[language]}
      />
      <Suspense fallback={null}>
        {settingsOpen && (
          <SettingsDialog
            advanced={prefs.advanced}
            onAdvanced={(advanced) => {
              update({ ...prefs, advanced });
            }}
            theme={prefs.theme}
            onTheme={(theme) => {
              update({ ...prefs, theme });
            }}
            zoom={prefs.zoom}
            onZoom={(zoom) => {
              update({ ...prefs, zoom });
            }}
            toolsOff={prefs.toolsOff}
            onTool={(id, on) => {
              if (id === "breakpoints" && !on) editor.current?.clearBreakpoints();
              update({ ...prefs, toolsOff: on ? prefs.toolsOff.filter((t) => t !== id) : [...prefs.toolsOff, id] });
            }}
            onClose={() => {
              setSettingsOpen(false);
            }}
          />
        )}
        {authorOpen && (
          <AuthorDialog
            onClose={() => {
              setAuthorOpen(false);
            }}
          />
        )}
        {welcomeOpen && (
          <WelcomeDialog
            onClose={(dontShowAgain) => {
              setWelcomeOpen(false);
              if (dontShowAgain) update({ ...prefs, welcomeDone: true });
            }}
          />
        )}
        {files$.dialog !== null && (
          <SaveDialog
            name={files$.dialog.name}
            type={files$.dialog.type}
            onSave={files$.finishSave}
            onCancel={files$.cancelSave}
          />
        )}
      </Suspense>
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
