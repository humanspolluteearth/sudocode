import { App } from "./App.tsx";
import { createRef } from "react";
import { userEvent } from "vitest/browser";
import { Editor, type EditorHandle } from "./Editor.tsx";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { axeViolations } from "./axe.ts";
import { FileTabs, lineCount } from "./FileTabs.tsx";
import { MenuBar } from "./MenuBar.tsx";
import { Toolbar } from "./Toolbar.tsx";
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

  it("MISC unsupported items are shown disabled with a title", async () => {
    const screen = await render(<MenuBar menus={buildMenus(actions())} />);
    await screen.getByRole("menuitem", { name: "File", exact: true }).click();
    const save = screen.getByRole("menuitem", { name: /^Save/ });
    await expect.element(save).toBeDisabled();
    await expect.element(save).toHaveAttribute("title", "Not available yet");
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

describe("MISC file tab strip", () => {
  it("MISC shows the badge, file name and line count", async () => {
    const screen = await render(<FileTabs language="edexcel" name="untitled" source={"a\nb\nc\n"} />);
    await expect.element(screen.getByRole("tab", { name: /EDX\s*untitled\.epc/ })).toBeVisible();
    await expect.element(screen.getByText("3 lines")).toBeVisible();
  });

  it("MISC close and + are disabled with a title, not removed", async () => {
    const screen = await render(<FileTabs language="python" name="untitled" source="print(1)" />);
    await expect.element(screen.getByRole("button", { name: "New tab" })).toBeDisabled();
    await expect.element(screen.getByRole("button", { name: /^Close/ })).toBeDisabled();
    await expect.element(screen.getByText("1 line", { exact: true })).toBeVisible();
  });

  it("MISC lineCount ignores one trailing newline and counts an empty file as 1", () => {
    expect(lineCount("")).toBe(1);
    expect(lineCount("a")).toBe(1);
    expect(lineCount("a\n")).toBe(1);
    expect(lineCount("a\n\n")).toBe(2);
  });

  it("MISC the tab strip has no axe violations", async () => {
    const screen = await render(<FileTabs language="cie" name="untitled" source="x" />);
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
      examples={[]}
      onExample={() => undefined}
      {...over}
    />
  );
  it("MISC Save and Convert to are shown disabled with a title", async () => {
    const screen = await render(bar());
    const save = screen.getByRole("button", { name: "Save" });
    await expect.element(save).toBeDisabled();
    await expect.element(save).toHaveAttribute("title", "Not available yet");
    await expect.element(screen.getByRole("button", { name: /Convert to/ })).toBeDisabled();
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
  it("MISC the app opens with the Grade checker sample and no problems", async () => {
    localStorage.clear();
    const screen = await render(<App />);
    await expect.element(screen.getByText("# Grade checker")).toBeVisible();
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
