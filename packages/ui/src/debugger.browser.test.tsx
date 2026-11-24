import "./styles.css";
import type { StackFrame, TraceRow } from "@sudocode/core";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { axeViolations } from "./axe.ts";
import { CallStack } from "./CallStack.tsx";
import { Console } from "./Console.tsx";
import { Editor } from "./Editor.tsx";
import { StepLimitDialog } from "./StepLimitDialog.tsx";
import { Toolbar } from "./Toolbar.tsx";
import { TraceTable } from "./TraceTable.tsx";
import { Variables } from "./Variables.tsx";

const frame: StackFrame = {
  name: "(main program)",
  line: 3,
  variables: [
    { name: "total", type: "INTEGER", value: "6" },
    { name: "name", type: "STRING", value: "Ann" },
  ],
};

describe("MISC console input box", () => {
  it("SH-05 the input box appears while waiting and sends the typed line without a newline", async () => {
    const onInput = vi.fn();
    const screen = await render(
      <Console
        output=""
        error={null}
        finishedNote={null}
        onClear={() => undefined}
        waiting={{ prompt: "" }}
        onInput={onInput}
      />,
    );
    const box = screen.getByRole("textbox", { name: "Input" });
    await expect.element(box).toHaveFocus();
    await box.fill("hello world");
    await userEvent.keyboard("{Enter}");
    expect(onInput).toHaveBeenCalledWith("hello world");
    await expect.element(box).toHaveValue("");
  });

  it("EDX-74 a device other than KEYBOARD is named on the input box", async () => {
    const screen = await render(
      <Console
        output=""
        error={null}
        finishedNote={null}
        onClear={() => undefined}
        waiting={{ prompt: "", device: "SENSOR" }}
      />,
    );
    await expect.element(screen.getByRole("textbox", { name: "Input from SENSOR" })).toBeVisible();
  });

  it('EDX-74 input from KEYBOARD is just "Input", with no device named', async () => {
    const screen = await render(
      <Console output="" error={null} finishedNote={null} onClear={() => undefined} waiting={{ prompt: "" }} />,
    );
    await expect.element(screen.getByRole("textbox", { name: "Input" })).toBeVisible();
    expect(screen.container.textContent).not.toContain("KEYBOARD");
    expect(screen.container.textContent).not.toContain("Input from");
  });

  it("SH-05 Enter on an empty box sends an empty line", async () => {
    const onInput = vi.fn();
    const screen = await render(
      <Console
        output=""
        error={null}
        finishedNote={null}
        onClear={() => undefined}
        waiting={{ prompt: "" }}
        onInput={onInput}
      />,
    );
    await expect.element(screen.getByRole("textbox", { name: "Input" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onInput).toHaveBeenCalledWith("");
  });

  it("SH-05 Escape on the input line ends the program", async () => {
    const onCancel = vi.fn();
    const screen = await render(
      <Console
        output=""
        error={null}
        finishedNote={null}
        onClear={() => undefined}
        waiting={{ prompt: "" }}
        onCancel={onCancel}
      />,
    );
    await screen.getByRole("textbox", { name: "Input" }).click();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("MISC input is typed on the prompt's own line, with no separate input area", async () => {
    const screen = await render(
      <div className="sc-root dark">
        <Console output="Name? " error={null} finishedNote={null} onClear={() => undefined} waiting={{ prompt: "" }} />
      </div>,
    );
    const out = screen.container.querySelector(".sc-out")?.getBoundingClientRect();
    const box = screen.getByRole("textbox", { name: "Input" }).element().getBoundingClientRect();
    expect(out).toBeDefined();
    // Same line: the input's vertical middle falls inside the prompt's box, and it starts to the right of it.
    expect(box.top + box.height / 2).toBeGreaterThan(out?.top ?? 0);
    expect(box.top + box.height / 2).toBeLessThan(out?.bottom ?? 0);
    expect(box.left).toBeGreaterThan((out?.left ?? 0) + 10);
    expect(screen.container.querySelector("form")).toBeNull();
    expect(screen.container.querySelector("button.sc-tb")).toBeNull();
  });

  it("MISC there is no input box when the program isn't waiting", async () => {
    const screen = await render(<Console output="x" error={null} finishedNote={null} onClear={() => undefined} />);
    expect(screen.container.querySelector("input")).toBeNull();
  });

  it("MISC the waiting console has no axe violations", async () => {
    const screen = await render(
      <Console output="" error={null} finishedNote={null} onClear={() => undefined} waiting={{ prompt: "" }} />,
    );
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});

describe("MISC Variables panel", () => {
  it("MISC lists each variable's name, type and value", async () => {
    const screen = await render(<Variables frame={frame} previous={null} />);
    await expect.element(screen.getByRole("rowheader", { name: "total" })).toBeVisible();
    await expect.element(screen.getByRole("cell", { name: "STRING" })).toBeVisible();
    await expect.element(screen.getByRole("cell", { name: "Ann" })).toBeVisible();
  });

  it("MISC marks only the variables whose value changed since the last pause", async () => {
    const previous = new Map([
      ["total", "3"],
      ["name", "Ann"],
    ]);
    const screen = await render(<Variables frame={frame} previous={previous} />);
    const changed = [...screen.container.querySelectorAll("tr.sc-changed th")].map((th) => th.textContent);
    expect(changed).toEqual(["total"]);
    await expect.element(screen.getByText("(changed)")).toBeInTheDocument();
  });

  it("MISC a variable that is new since the last pause counts as changed", async () => {
    const screen = await render(<Variables frame={frame} previous={new Map([["total", "6"]])} />);
    const changed = [...screen.container.querySelectorAll("tr.sc-changed th")].map((th) => th.textContent);
    expect(changed).toEqual(["name"]);
  });

  it("MISC says how to see variables when not paused", async () => {
    const screen = await render(<Variables frame={null} previous={null} />);
    await expect.element(screen.getByText(/Set a breakpoint, then Run/)).toBeVisible();
  });

  it("MISC has no axe violations", async () => {
    const screen = await render(<Variables frame={frame} previous={new Map([["total", "3"]])} />);
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});

describe("MISC trace table", () => {
  const rows: TraceRow[] = [
    { kind: "assign", line: 1, variable: "total", value: "0" },
    { kind: "assign", line: 2, variable: "i", value: "1" },
    { kind: "assign", line: 3, variable: "total", value: "1" },
    { kind: "output", line: 5, text: "1" },
  ];
  const cells = (container: HTMLElement): string[][] =>
    [...container.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => c.textContent));

  it("SH-17 columns are Line, the variables in order of first assignment, then Output; one row per event", async () => {
    const screen = await render(<TraceTable rows={rows} recorded />);
    expect(cells(screen.container)).toEqual([
      ["Line", "total", "i", "Output"],
      ["1", "0", "", ""],
      ["2", "", "1", ""],
      ["3", "1", "", ""],
      ["5", "", "", "1"],
    ]);
  });

  it("MISC says to open the panel first when the run didn't record a trace", async () => {
    const screen = await render(<TraceTable rows={[]} recorded={false} />);
    await expect.element(screen.getByText(/before you press Run/)).toBeVisible();
  });

  it("MISC has no axe violations", async () => {
    const screen = await render(<TraceTable rows={rows} recorded />);
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});

describe("MISC step-limit dialog", () => {
  it("SH-14 asks whether to continue, with Keep going focused, and reports the choice", async () => {
    const onContinue = vi.fn();
    const onStop = vi.fn();
    const screen = await render(<StepLimitDialog line={4} onContinue={onContinue} onStop={onStop} />);
    await expect.element(screen.getByRole("alertdialog", { name: "Still running" })).toBeVisible();
    await expect.element(screen.getByText(/10 million steps and is now at line 4/)).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Keep going" })).toHaveFocus();
    await screen.getByRole("button", { name: "Keep going" }).click();
    await screen.getByRole("button", { name: "Stop" }).click();
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("MISC has no axe violations", async () => {
    const screen = await render(<StepLimitDialog line={4} onContinue={() => undefined} onStop={() => undefined} />);
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});

describe("MISC debugger toolbar buttons", () => {
  const bar = (over: Partial<Parameters<typeof Toolbar>[0]>) => (
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

  it("MISC Continue and Step over work only while paused; Pause only while running", async () => {
    const onContinue = vi.fn();
    const onStepOver = vi.fn();
    const screen = await render(bar({ running: true, paused: false, onContinue, onStepOver }));
    await expect.element(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await expect.element(screen.getByRole("button", { name: "Step over" })).toBeDisabled();
    await expect.element(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
    await screen.rerender(bar({ running: true, paused: true, onContinue, onStepOver }));
    await expect.element(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
    await screen.getByRole("button", { name: "Continue" }).click();
    await screen.getByRole("button", { name: "Step over" }).click();
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onStepOver).toHaveBeenCalledOnce();
  });
});

describe("MISC breakpoint gutter", () => {
  /** Presses the mouse on the breakpoint gutter beside line `n` (CodeMirror finds the line from the height). */
  const clickGutter = async (container: HTMLElement, n: number): Promise<void> => {
    // Wait for CodeMirror to measure its lines, so the height maps to the right line.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      }),
    );
    const number = [...container.querySelectorAll<HTMLElement>(".cm-lineNumbers .cm-gutterElement")].find(
      (el) => el.textContent === String(n),
    );
    const gutter = container.querySelector<HTMLElement>(".sc-bp-gutter");
    if (number === undefined || gutter === null) throw new Error(`No gutter for line ${String(n)}`);
    const r = number.getBoundingClientRect();
    const x = gutter.getBoundingClientRect().left + 4;
    gutter.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: r.top + r.height / 2 }));
  };

  it("MISC clicking the gutter sets and clears a breakpoint on that line", async () => {
    const onBreakpointsChange = vi.fn();
    const screen = await render(
      <Editor
        value={"a\nb\nc\n"}
        onChange={() => undefined}
        diagnostics={[]}
        onBreakpointsChange={onBreakpointsChange}
      />,
    );
    await clickGutter(screen.container, 2);
    expect(onBreakpointsChange).toHaveBeenLastCalledWith([2]);
    await clickGutter(screen.container, 3);
    expect(onBreakpointsChange).toHaveBeenLastCalledWith([2, 3]);
    await clickGutter(screen.container, 2);
    expect(onBreakpointsChange).toHaveBeenLastCalledWith([3]);
  });

  it("MISC F9 sets a breakpoint on the cursor's line", async () => {
    const onBreakpointsChange = vi.fn();
    const screen = await render(
      <Editor
        value={"first\nsecond\n"}
        onChange={() => undefined}
        diagnostics={[]}
        onBreakpointsChange={onBreakpointsChange}
      />,
    );
    await screen.getByText("first").click();
    await userEvent.keyboard("{F9}");
    expect(onBreakpointsChange).toHaveBeenLastCalledWith([1]);
  });

  it("MISC a breakpoint moves with its line when a line is typed above it", async () => {
    const onBreakpointsChange = vi.fn();
    const screen = await render(
      <Editor
        value={"first\nsecond\n"}
        onChange={() => undefined}
        diagnostics={[]}
        onBreakpointsChange={onBreakpointsChange}
      />,
    );
    await clickGutter(screen.container, 2);
    expect(onBreakpointsChange).toHaveBeenLastCalledWith([2]);
    await screen.getByText("first").click();
    await userEvent.keyboard("{Home}new{Enter}");
    expect(onBreakpointsChange).toHaveBeenLastCalledWith([3]);
  });

  it("MISC the paused line is highlighted", async () => {
    const screen = await render(
      <Editor value={"a\nb\nc\n"} onChange={() => undefined} diagnostics={[]} pausedLine={2} />,
    );
    await vi.waitFor(() => {
      expect(screen.container.querySelector(".sc-paused-line")?.textContent).toBe("b");
    });
    await screen.rerender(<Editor value={"a\nb\nc\n"} onChange={() => undefined} diagnostics={[]} pausedLine={null} />);
    await vi.waitFor(() => {
      expect(screen.container.querySelector(".sc-paused-line")).toBeNull();
    });
  });
});

describe("MISC step into, step out and the call stack panel", () => {
  it("MISC Step into and Step out are enabled only while paused and call their handlers", async () => {
    const onStepInto = vi.fn();
    const onStepOut = vi.fn();
    const make = (paused: boolean) => (
      <Toolbar
        running
        paused={paused}
        canRun
        onRun={() => undefined}
        onStop={() => undefined}
        onStepInto={onStepInto}
        onStepOut={onStepOut}
        zoom={100}
        onZoom={() => undefined}
        theme="system"
        onTheme={() => undefined}
        examples={[]}
        onExample={() => undefined}
      />
    );
    const screen = await render(make(false));
    await expect.element(screen.getByRole("button", { name: "Step into" })).toBeDisabled();
    await expect.element(screen.getByRole("button", { name: "Step out" })).toBeDisabled();
    await screen.rerender(make(true));
    await screen.getByRole("button", { name: "Step into" }).click();
    await screen.getByRole("button", { name: "Step out" }).click();
    expect([onStepInto.mock.calls.length, onStepOut.mock.calls.length]).toEqual([1, 1]);
  });

  it("MISC the call stack lists the innermost call first with its line", async () => {
    const stack: StackFrame[] = [
      { name: "fact", line: 4, variables: [] },
      { name: "(main program)", line: 9, variables: [] },
    ];
    const screen = await render(<CallStack stack={stack} />);
    const rows = [...screen.container.querySelectorAll("li")].map((li) => li.textContent);
    expect(rows).toEqual(["factline 4", "(main program)line 9"]);
  });

  it("MISC with no stack the panel says how to get one", async () => {
    const screen = await render(<CallStack stack={[]} />);
    await expect.element(screen.getByText("Pause the program to see the calls it is inside.")).toBeVisible();
  });
});
