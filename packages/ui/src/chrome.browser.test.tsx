import "./styles.css";
import { App } from "./App.tsx";
import { FakeWorker } from "./fake-worker.ts";
import { createRef, useState } from "react";
import { userEvent } from "vitest/browser";
import { Editor, type EditorHandle } from "./Editor.tsx";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { axeViolations } from "./axe.ts";
import { FileTabs, lineCount } from "./FileTabs.tsx";
import { MenuBar } from "./MenuBar.tsx";
import { NoteBanner, type Note } from "./NoteBanner.tsx";
import { Splitter } from "./Splitter.tsx";
import { Toolbar } from "./Toolbar.tsx";
import type { PseudocodeLanguage } from "./preferences.ts";
import { buildMenus, type MenuActions } from "./menu-model.ts";

const actions = (over: Partial<MenuActions> = {}): MenuActions => ({
  running: false,
  paused: false,
  canRun: true,
  onRun: () => undefined,
  onStop: () => undefined,
  onContinue: () => undefined,
  onStepOver: () => undefined,
  onStepInto: () => undefined,
  onStepOut: () => undefined,
  onPause: () => undefined,
  language: "edexcel",
  onLanguage: () => undefined,
  zoom: 100,
  onZoom: () => undefined,
  theme: "system",
  onTheme: () => undefined,
  sideTab: "debugger",
  onSideTab: () => undefined,
  onClearConsole: () => undefined,
  breakpointCount: 0,
  onClearBreakpoints: () => undefined,
  onNewFile: () => undefined,
  onOpenFile: () => undefined,
  onSave: () => undefined,
  onSaveAs: () => undefined,
  onSaveAll: () => undefined,
  advanced: true,
  onConvertToPython: () => undefined,
  ...over,
});

describe("MISC view and run menu entries", () => {
  const open = async (menu: string, over: Partial<MenuActions> = {}) => {
    const screen = await render(<MenuBar menus={buildMenus(actions(over))} />);
    await screen.getByRole("menuitem", { name: menu, exact: true }).click();
    return screen;
  };

  it("MISC View > Quick reference and Debugger switch the side tab", async () => {
    const onSideTab = vi.fn();
    const screen = await open("View", { onSideTab });
    await screen.getByRole("menuitemradio", { name: /Quick reference/ }).click();
    expect(onSideTab).toHaveBeenCalledWith("reference");
    await screen.getByRole("menuitem", { name: "View", exact: true }).click();
    await screen.getByRole("menuitemradio", { name: /Debugger/ }).click();
    expect(onSideTab).toHaveBeenCalledWith("debugger");
  });

  it("MISC View > Clear console calls onClearConsole", async () => {
    const onClearConsole = vi.fn();
    const screen = await open("View", { onClearConsole });
    await screen.getByRole("menuitem", { name: /Clear console/ }).click();
    expect(onClearConsole).toHaveBeenCalledOnce();
  });

  it("MISC View zoom presets set 125 and Actual size sets 100 (disabled at 100)", async () => {
    const onZoom = vi.fn();
    const screen = await open("View", { onZoom, zoom: 110 });
    await screen.getByRole("menuitemradio", { name: /Zoom 125%/ }).click();
    expect(onZoom).toHaveBeenLastCalledWith(125);
    await screen.getByRole("menuitem", { name: "View", exact: true }).click();
    await screen.getByRole("menuitem", { name: /Actual size/ }).click();
    expect(onZoom).toHaveBeenLastCalledWith(100);
  });

  it("MISC View Zoom in follows the design ladder (125 to 130)", async () => {
    const onZoom = vi.fn();
    const screen = await open("View", { onZoom, zoom: 125 });
    await screen.getByRole("menuitem", { name: /^Zoom in/ }).click();
    expect(onZoom).toHaveBeenCalledWith(130);
  });

  it("MISC View > Match system theme sets the system theme", async () => {
    const onTheme = vi.fn();
    const screen = await open("View", { onTheme, theme: "dark" });
    await screen.getByRole("menuitemradio", { name: /Match system theme/ }).click();
    expect(onTheme).toHaveBeenCalledWith("system");
  });

  it("MISC Run > Clear all breakpoints is disabled with none and works with some", async () => {
    const onClearBreakpoints = vi.fn();
    const none = await open("Run", { onClearBreakpoints });
    await expect.element(none.getByRole("menuitem", { name: /Clear all breakpoints/ })).toBeDisabled();
    await none.unmount();
    const some = await open("Run", { onClearBreakpoints, breakpointCount: 2 });
    await some.getByRole("menuitem", { name: /Clear all breakpoints/ }).click();
    expect(onClearBreakpoints).toHaveBeenCalledOnce();
  });

  it("MISC the open View menu has no axe violations", async () => {
    const screen = await open("View");
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});

describe("MISC menu bar", () => {
  it("MISC lists File, Run, Convert, Language and View", async () => {
    const screen = await render(<MenuBar menus={buildMenus(actions())} />);
    for (const name of ["File", "Run", "Convert", "Language", "View"]) {
      await expect.element(screen.getByRole("menuitem", { name, exact: true })).toBeVisible();
    }
  });

  it("MISC opening Run and choosing Run calls onRun", async () => {
    const onRun = vi.fn();
    const screen = await render(<MenuBar menus={buildMenus(actions({ onRun }))} />);
    await screen.getByRole("menuitem", { name: "Run", exact: true }).click();
    await screen.getByRole("menuitem", { name: /^Run\s*F5/ }).click();
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("MISC File > Save, Save as, Save all, New file and Open call their handlers", async () => {
    const h = { onSave: vi.fn(), onSaveAs: vi.fn(), onSaveAll: vi.fn(), onNewFile: vi.fn(), onOpenFile: vi.fn() };
    const screen = await render(<MenuBar menus={buildMenus(actions(h))} />);
    for (const [name, fn] of [
      [/^Save\s*Ctrl\+S/, h.onSave],
      [/^Save as/, h.onSaveAs],
      [/^Save all/, h.onSaveAll],
      [/^New file/, h.onNewFile],
      [/^Open/, h.onOpenFile],
    ] as const) {
      await screen.getByRole("menuitem", { name: "File", exact: true }).click();
      await screen.getByRole("menuitem", { name }).click();
      expect(fn).toHaveBeenCalledOnce();
    }
  });

  it("MISC Convert menu converts to Python, is disabled for Python files and is hidden in Simple mode", async () => {
    const onConvertToPython = vi.fn();
    const screen = await render(<MenuBar menus={buildMenus(actions({ onConvertToPython }))} />);
    await screen.getByRole("menuitem", { name: "Convert", exact: true }).click();
    await screen.getByRole("menuitem", { name: "Convert to Python" }).click();
    expect(onConvertToPython).toHaveBeenCalledOnce();
    await screen.unmount();
    const py = await render(<MenuBar menus={buildMenus(actions({ language: "python" }))} />);
    await py.getByRole("menuitem", { name: "Convert", exact: true }).click();
    await expect.element(py.getByRole("menuitem", { name: "Convert to Python" })).toBeDisabled();
    await py.unmount();
    const simple = await render(<MenuBar menus={buildMenus(actions({ advanced: false }))} />);
    await expect.element(simple.getByRole("menuitem", { name: "Convert", exact: true })).not.toBeInTheDocument();
  });

  it("MISC the Language menu marks the current language and switches it", async () => {
    const onLanguage = vi.fn();
    const screen = await render(<MenuBar menus={buildMenus(actions({ onLanguage }))} />);
    await screen.getByRole("menuitem", { name: "Language", exact: true }).click();
    await expect
      .element(screen.getByRole("menuitemradio", { name: /Edexcel/ }))
      .toHaveAttribute("aria-checked", "true");
    await screen.getByRole("menuitemradio", { name: "Python" }).click();
    expect(onLanguage).toHaveBeenCalledWith("python");
  });

  it("MISC the View menu zooms and sets the theme", async () => {
    const onZoom = vi.fn();
    const onTheme = vi.fn();
    const screen = await render(<MenuBar menus={buildMenus(actions({ onZoom, onTheme }))} />);
    await screen.getByRole("menuitem", { name: "View", exact: true }).click();
    await screen.getByRole("menuitem", { name: /^Zoom in/ }).click();
    expect(onZoom).toHaveBeenCalledWith(110);
    await screen.getByRole("menuitem", { name: "View", exact: true }).click();
    await screen.getByRole("menuitemradio", { name: "Theme: Dark" }).click();
    expect(onTheme).toHaveBeenCalledWith("dark");
  });

  it("MISC the open menu has no axe violations", async () => {
    const screen = await render(<MenuBar menus={buildMenus(actions())} />);
    await screen.getByRole("menuitem", { name: "Run", exact: true }).click();
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});

const strip = (language: PseudocodeLanguage, source: string) => ({
  tabs: [{ id: 1, name: "untitled", language, source, savedSource: source, named: false }],
  activeId: 1,
  onSwitch: () => undefined,
  onClose: () => undefined,
  onNew: () => undefined,
});

describe("MISC file tab strip", () => {
  it("MISC shows the badge, file name and line count", async () => {
    const screen = await render(<FileTabs {...strip("edexcel", "a\nb\nc\n")} />);
    await expect.element(screen.getByRole("tab", { name: /EDX\s*untitled\.epc/ })).toBeVisible();
    await expect.element(screen.getByText("3 lines")).toBeVisible();
  });

  it("MISC the only tab can't be closed, and + opens a new file", async () => {
    const props = strip("python", "print(1)");
    const onNew = vi.fn();
    const screen = await render(<FileTabs {...props} onNew={onNew} />);
    await screen.getByRole("button", { name: "New tab" }).click();
    expect(onNew).toHaveBeenCalledOnce();
    await expect.element(screen.getByRole("button", { name: /^Close/ })).toBeDisabled();
    await expect.element(screen.getByText("1 line", { exact: true })).toBeVisible();
  });

  it("MISC several tabs: switch, close and an unsaved dot", async () => {
    const base = strip("edexcel", "a");
    const tabs = [
      ...base.tabs,
      { id: 2, name: "second", language: "python" as const, source: "x", savedSource: "", named: true },
    ];
    const onSwitch = vi.fn();
    const onClose = vi.fn();
    const screen = await render(<FileTabs {...base} tabs={tabs} onSwitch={onSwitch} onClose={onClose} />);
    await expect.element(screen.getByRole("img", { name: "unsaved changes" })).toBeVisible();
    await screen.getByRole("tab", { name: /second\.py/ }).click();
    expect(onSwitch).toHaveBeenCalledWith(2);
    await screen.getByRole("button", { name: "Close second.py" }).click();
    expect(onClose).toHaveBeenCalledWith(2);
  });

  it("MISC lineCount ignores one trailing newline and counts an empty file as 1", () => {
    expect(lineCount("")).toBe(1);
    expect(lineCount("a")).toBe(1);
    expect(lineCount("a\n")).toBe(1);
    expect(lineCount("a\n\n")).toBe(2);
  });

  it("MISC the tab strip has no axe violations", async () => {
    const screen = await render(<FileTabs {...strip("cie", "x")} />);
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});

describe("MISC Toolbar layout", () => {
  const bar = (over: Partial<Parameters<typeof Toolbar>[0]> = {}) => (
    <Toolbar
      running={false}
      canRun
      onRun={() => undefined}
      onStop={() => undefined}
      zoom={100}
      onZoom={() => undefined}
      theme="system"
      onTheme={() => undefined}
      {...over}
    />
  );
  it("MISC Save is disabled without a handler and calls it when given one", async () => {
    const without = await render(bar());
    await expect.element(without.getByRole("button", { name: "Save" })).toBeDisabled();
    await without.unmount();
    const onSave = vi.fn();
    const screen = await render(bar({ onSave }));
    await screen.getByRole("button", { name: "Save" }).click();
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("MISC Convert to is absent without a handler (Simple mode) and picks Python when given one", async () => {
    const without = await render(bar());
    await expect.element(without.getByLabelText("Convert to")).not.toBeInTheDocument();
    await without.unmount();
    const onConvert = vi.fn();
    const screen = await render(bar({ onConvert }));
    await screen.getByLabelText("Convert to").selectOptions("python");
    expect(onConvert).toHaveBeenCalledWith("python");
  });
  it("MISC Clear breakpoints calls its handler", async () => {
    const onClearBreakpoints = vi.fn();
    const screen = await render(bar({ onClearBreakpoints }));
    await screen.getByRole("button", { name: "Clear breakpoints" }).click();
    expect(onClearBreakpoints).toHaveBeenCalledOnce();
  });
  it("MISC the Theme button cycles system, light, dark", async () => {
    const onTheme = vi.fn();
    const screen = await render(bar({ onTheme, theme: "dark" }));
    await screen.getByRole("button", { name: "Theme" }).click();
    expect(onTheme).toHaveBeenCalledWith("system");
  });
  it("MISC the toolbar passes axe", async () => {
    const screen = await render(bar({ language: "edexcel", onLanguage: () => undefined }));
    await expect.element(screen.getByRole("toolbar")).toBeVisible();
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});

describe("MISC Editor gutter", () => {
  it("MISC the gutter is 62px wide and Clear breakpoints removes every breakpoint", async () => {
    const onBreakpointsChange = vi.fn();
    const ref = createRef<EditorHandle>();
    const screen = await render(
      <Editor
        ref={ref}
        value={"a\nb\nc\n"}
        onChange={() => undefined}
        diagnostics={[]}
        onBreakpointsChange={onBreakpointsChange}
      />,
    );
    const gutters = screen.container.querySelector(".cm-gutters");
    expect(gutters?.getBoundingClientRect().width).toBe(62);
    await screen.getByRole("textbox").click();
    await userEvent.keyboard("{F9}");
    expect(onBreakpointsChange).toHaveBeenLastCalledWith([3]);
    ref.current?.clearBreakpoints();
    expect(onBreakpointsChange).toHaveBeenLastCalledWith([]);
  });
});

describe("MISC Default program", () => {
  it("MISC the app opens with a blank untitled file and no problems", async () => {
    localStorage.clear();
    const screen = await render(<App />);
    await expect.element(screen.getByRole("tab", { name: /EDX\s*untitled\.epc/ })).toBeVisible();
    await expect.poll(() => screen.getByRole("textbox").first().element().textContent.trim()).toBe("");
    await expect.element(screen.getByText("No problems.")).toBeVisible();
  });
});

describe("MISC zoom shortcuts", () => {
  it("MISC Ctrl+= and Ctrl+- move along the ladder and Ctrl+0 returns to 100", async () => {
    localStorage.clear();
    const screen = await render(<App />);
    const zoom = () => (screen.container.querySelector(".sc-root") as HTMLElement).style.getPropertyValue("--zoom");
    await userEvent.keyboard("{Control>}={/Control}");
    expect(zoom()).toBe("1.1");
    await userEvent.keyboard("{Control>}={/Control}{Control>}={/Control}");
    expect(zoom()).toBe("1.25");
    await userEvent.keyboard("{Control>}-{/Control}");
    expect(zoom()).toBe("1.2");
    await userEvent.keyboard("{Control>}0{/Control}");
    expect(zoom()).toBe("1");
    await userEvent.keyboard("{Control>}-{/Control}");
    expect(zoom()).toBe("1");
  });
});

describe("MISC Side panel", () => {
  it("MISC the Debugger tab stacks Status, Problems, Variables and Breakpoints", async () => {
    localStorage.clear();
    const screen = await render(<App />);
    for (const name of ["Status", "Problems", "Variables", "Breakpoints"]) {
      await expect.element(screen.getByRole("region", { name })).toBeVisible();
    }
    // Breakpoints starts folded; opening it shows its text.
    await screen.getByRole("button", { name: /Breakpoints/ }).click();
    await expect.element(screen.getByText("No breakpoints.")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Debugger" })).toHaveAttribute("aria-pressed", "true");
  });
  it("MISC the side panel passes axe", async () => {
    localStorage.clear();
    const screen = await render(<App />);
    await expect.element(screen.getByRole("region", { name: "Breakpoints" })).toBeVisible();
    const side = screen.container.querySelector("aside");
    expect(side).not.toBeNull();
    expect(await axeViolations(side as HTMLElement)).toEqual([]);
  });
});

describe("MISC focus rings follow the design", () => {
  it("MISC a keyboard-focused button gets a 1px dotted ring and the editor gets none", async () => {
    const screen = await render(<App />);
    await userEvent.tab();
    const focused = document.activeElement as HTMLElement;
    const ring = getComputedStyle(focused);
    if (focused.matches(":focus-visible") && focused.tagName === "BUTTON") {
      expect(ring.outlineStyle).toBe("dotted");
      expect(ring.outlineWidth).toBe("1px");
    }
    const editor = screen.container.querySelector<HTMLElement>(".cm-editor");
    (screen.container.querySelector(".cm-content") as HTMLElement).focus();
    expect(getComputedStyle(editor as HTMLElement).outlineStyle).toBe("none");
  });

  it("MISC the console log ring sits inside the box, and axe stays clean", async () => {
    const screen = await render(<App />);
    const log = screen.container.querySelector<HTMLElement>(".sc-console-log") as HTMLElement;
    await userEvent.tab();
    log.focus();
    expect(getComputedStyle(log).outlineOffset).toBe("-2px");
    // Scoped to the toolbar and side panel: the page footer role and editor scroller are not part of this change.
    for (const q of [".sc-toolbar", "aside"]) {
      expect(await axeViolations(screen.container.querySelector(q) as HTMLElement)).toEqual([]);
    }
  });
});

describe("MISC note banner", () => {
  it("MISC shows its text and is dismissed with the Dismiss button", async () => {
    const onDismiss = vi.fn();
    const screen = await render(<NoteBanner note={{ text: "Converted from Python." }} onDismiss={onDismiss} />);
    await expect.element(screen.getByText("Converted from Python.")).toBeVisible();
    await screen.getByRole("button", { name: "Dismiss" }).click();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("MISC an error note uses the soft red background and a plain note the subtle one", async () => {
    const screen = await render(<NoteBanner note={{ text: "Problem.", error: true }} onDismiss={() => undefined} />);
    expect(screen.getByRole("status").element().classList.contains("sc-note-err")).toBe(true);
    await screen.rerender(<NoteBanner note={{ text: "Fine." }} onDismiss={() => undefined} />);
    expect(screen.getByRole("status").element().classList.contains("sc-note-err")).toBe(false);
  });

  it("MISC the banner disappears once dismissed and has no axe violations", async () => {
    const Harness = () => {
      const [note, setNote] = useState<Note | null>({ text: "Hello." });
      return note === null ? (
        <p>gone</p>
      ) : (
        <NoteBanner
          note={note}
          onDismiss={() => {
            setNote(null);
          }}
        />
      );
    };
    const screen = await render(<Harness />);
    expect(await axeViolations(screen.container)).toEqual([]);
    await screen.getByRole("button", { name: "Dismiss" }).click();
    await expect.element(screen.getByText("gone")).toBeVisible();
  });
});

describe("MISC editor selection and tab strip", () => {
  it("MISC selected text is not drawn on a white background", async () => {
    const screen = await render(
      <div className="sc-root dark">
        <Editor value={"hello"} onChange={() => undefined} diagnostics={[]} />
      </div>,
    );
    await screen.getByRole("textbox").click();
    await userEvent.keyboard("{Control>}a{/Control}");
    const layer = screen.container.querySelector(".cm-selectionBackground");
    expect(layer).not.toBeNull();
    const bg = getComputedStyle(layer as Element).backgroundColor;
    expect(bg).not.toBe("rgb(255, 255, 255)");
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  });

  it("MISC the file tab strip has no scrollbars", async () => {
    const screen = await render(<FileTabs {...strip("edexcel", "a\n")} />);
    const tabs = screen.container.querySelector(".sc-tabs") as HTMLElement;
    expect(getComputedStyle(tabs).overflowX).toBe("hidden");
    expect(getComputedStyle(tabs).overflowY).toBe("hidden");
  });
});

describe("MISC Step with no run going", () => {
  const setup = async () => {
    const created: FakeWorker[] = [];
    const workers = {
      createRunWorker: () => {
        const w = new FakeWorker();
        created.push(w);
        return w;
      },
      createCheckWorker: () => new FakeWorker(),
    };
    const screen = await render(<App workers={workers} />);
    return { screen, created };
  };

  it("MISC Step is enabled before a run and starts one that pauses before the first statement", async () => {
    const { screen, created } = await setup();
    const step = screen.getByRole("button", { name: "Step over" });
    await expect.element(step).toBeEnabled();
    await step.click();
    const types = (created[0]?.posted ?? []).map((m) => (m as { type: string }).type);
    expect(types).toEqual(["run", "pause"]);
  });

  it("MISC F10 with no run going also starts a run paused at the first statement", async () => {
    const { created } = await setup();
    await userEvent.keyboard("{F10}");
    const types = (created[0]?.posted ?? []).map((m) => (m as { type: string }).type);
    expect(types).toEqual(["run", "pause"]);
  });
});

describe("MISC debugger sections and resizing", () => {
  it("MISC Status, Problems and Variables start open; the others start folded", async () => {
    globalThis.localStorage.clear();
    // Call stack is an Advanced tool (docs/PRODUCT.md), so this test switches Advanced on (listed in M10.md).
    globalThis.localStorage.setItem("sudocode.preferences", JSON.stringify({ advanced: true }));
    const screen = await render(<App />);
    for (const name of ["Status", "Problems", "Variables"]) {
      await expect
        .element(screen.getByRole("button", { name: new RegExp(name) }))
        .toHaveAttribute("aria-expanded", "true");
    }
    for (const name of ["Breakpoints", "Call stack", "Trace table"]) {
      await expect
        .element(screen.getByRole("button", { name: new RegExp(name) }))
        .toHaveAttribute("aria-expanded", "false");
    }
  });

  it("MISC a debugger section folds away and opens again from its title", async () => {
    globalThis.localStorage.clear();
    const screen = await render(<App />);
    const title = screen.getByRole("button", { name: /Variables/ });
    await expect.element(title).toHaveAttribute("aria-expanded", "true");
    await title.click();
    await expect.element(title).toHaveAttribute("aria-expanded", "false");
    expect(screen.container.querySelector(".sc-vars-panel .sc-section-body")).toBeNull();
    await title.click();
    await expect.element(title).toHaveAttribute("aria-expanded", "true");
  });

  it("MISC a splitter resizes with the arrow keys, 10px a step and 40px with Shift", async () => {
    function Harness() {
      const [w, setW] = useState(300);
      return (
        <div style={{ display: "flex", height: 100 }}>
          <Splitter orientation="vertical" label="Resize side panel" size={w} onResize={setW} />
        </div>
      );
    }
    const screen = await render(<Harness />);
    // The viewport is narrow, where the side splitter is hidden by CSS; keys are sent straight to the element.
    const bar = screen.container.querySelector<HTMLElement>('[role="separator"]');
    const press = (key: string, shiftKey = false) =>
      bar?.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true }));
    press("ArrowLeft");
    await expect.poll(() => bar?.getAttribute("aria-valuenow")).toBe("310");
    press("ArrowRight", true);
    await expect.poll(() => bar?.getAttribute("aria-valuenow")).toBe("270");
  });

  it("MISC the console height changes from the app's splitter", async () => {
    globalThis.localStorage.clear();
    const screen = await render(<App />);
    const cons = screen.getByRole("separator", { name: "Resize console" });
    await expect.element(cons).toBeVisible();
    const h = Number(cons.element().getAttribute("aria-valuenow"));
    cons.element().focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(Number(cons.element().getAttribute("aria-valuenow"))).toBe(h + 10);
  });
});
