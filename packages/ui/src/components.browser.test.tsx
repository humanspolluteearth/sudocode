import type { Diagnostic } from "@sudocode/core";
import { EDEXCEL_EXAMPLES } from "@sudocode/core";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { axeViolations } from "./axe.ts";
import { Console } from "./Console.tsx";
import { Editor } from "./Editor.tsx";
import { Problems } from "./Problems.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { Toolbar } from "./Toolbar.tsx";

const diag = (over: Partial<Diagnostic> = {}): Diagnostic => ({
  code: "E-TEST",
  severity: "error",
  line: 2,
  column: 1,
  message: "Something is wrong.",
  hint: "Fix it.",
  ...over,
});

const toolbar = (over: Partial<Parameters<typeof Toolbar>[0]> = {}) => (
  <Toolbar
    running={false}
    canRun
    onRun={() => undefined}
    onStop={() => undefined}
    zoom={100}
    onZoom={() => undefined}
    theme="system"
    onTheme={() => undefined}
    examples={EDEXCEL_EXAMPLES}
    onExample={() => undefined}
    {...over}
  />
);

describe("MISC Toolbar", () => {
  it("MISC Run calls onRun and is disabled while running", async () => {
    const onRun = vi.fn();
    const screen = await render(toolbar({ onRun }));
    await screen.getByRole("button", { name: "Run" }).click();
    expect(onRun).toHaveBeenCalledOnce();
    await screen.rerender(toolbar({ running: true, onRun }));
    await expect.element(screen.getByRole("button", { name: "Run" })).toBeDisabled();
    await expect.element(screen.getByRole("button", { name: "Reset" })).toBeEnabled();
  });

  it("MISC choosing an example calls onExample with that example", async () => {
    const onExample = vi.fn();
    const screen = await render(toolbar({ onExample }));
    await screen.getByRole("combobox", { name: /Example/ }).selectOptions(EDEXCEL_EXAMPLES[0]?.id ?? "");
    expect(onExample).toHaveBeenCalledWith(EDEXCEL_EXAMPLES[0]);
  });

  it("MISC the language menu reports the chosen pseudocode", async () => {
    const onLanguage = vi.fn();
    const screen = await render(toolbar({ language: "edexcel", onLanguage }));
    await screen.getByRole("combobox", { name: /Language/ }).selectOptions("cie");
    expect(onLanguage).toHaveBeenCalledWith("cie");
  });

  it("MISC zoom buttons stop at 100% and 150%", async () => {
    const screen = await render(toolbar({ zoom: 100 }));
    await expect.element(screen.getByRole("button", { name: /Zoom out/ })).toBeDisabled();
    await screen.rerender(toolbar({ zoom: 150 }));
    await expect.element(screen.getByRole("button", { name: /Zoom in/ })).toBeDisabled();
  });

  it("MISC has no axe violations", async () => {
    const screen = await render(toolbar());
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});

describe("MISC Console", () => {
  it("MISC shows the hint when empty, then output and an error", async () => {
    const screen = await render(<Console output="" error={null} finishedNote={null} onClear={() => undefined} />);
    await expect.element(screen.getByText("Press Run to see your program's output here.")).toBeVisible();
    await screen.rerender(
      <Console
        output={"Hello\n"}
        error={diag({ line: 3, message: "Boom." })}
        finishedNote="Program finished"
        onClear={() => undefined}
      />,
    );
    await expect.element(screen.getByText("Hello")).toBeVisible();
    await expect.element(screen.getByText(/Error \(line 3\): Boom\./)).toBeVisible();
    await expect.element(screen.getByText("Program finished")).toBeVisible();
  });

  it("MISC Clear calls onClear", async () => {
    const onClear = vi.fn();
    const screen = await render(<Console output="x" error={null} finishedNote={null} onClear={onClear} />);
    await screen.getByRole("button", { name: "Clear" }).click();
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("MISC has no axe violations", async () => {
    const screen = await render(
      <Console output="Hi" error={diag()} finishedNote="Program finished" onClear={() => undefined} />,
    );
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});

describe("MISC Problems", () => {
  it("MISC lists problems and reports the one clicked", async () => {
    const onSelect = vi.fn();
    const d = diag({ message: "Missing END IF." });
    const screen = await render(<Problems diagnostics={[d]} onSelect={onSelect} />);
    await screen.getByRole("button", { name: /Missing END IF\./ }).click();
    expect(onSelect).toHaveBeenCalledWith(d);
  });

  it("MISC says there are no problems when the list is empty", async () => {
    const screen = await render(<Problems diagnostics={[]} onSelect={() => undefined} />);
    await expect.element(screen.getByText("No problems.")).toBeVisible();
  });

  it("MISC has no axe violations", async () => {
    const screen = await render(
      <Problems diagnostics={[diag(), diag({ severity: "warning" })]} onSelect={() => undefined} />,
    );
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});

describe("MISC Editor", () => {
  it("MISC shows the program text and reports typing", async () => {
    const onChange = vi.fn();
    const screen = await render(<Editor value={"SEND 'hi' TO DISPLAY\n"} onChange={onChange} diagnostics={[]} />);
    await expect.element(screen.getByText("SEND 'hi' TO DISPLAY")).toBeVisible();
    await screen.getByRole("textbox", { name: "Program editor" }).fill("SEND 1 TO DISPLAY");
    expect(onChange).toHaveBeenLastCalledWith("SEND 1 TO DISPLAY");
  });

  it("MISC underlines a diagnostic's line", async () => {
    const screen = await render(
      <Editor value={"a\nb\n"} onChange={() => undefined} diagnostics={[diag({ line: 2 })]} />,
    );
    await vi.waitFor(() => {
      expect(screen.container.querySelector(".cm-lintRange-error")).not.toBeNull();
    });
  });

  it("MISC has no axe violations", async () => {
    const screen = await render(
      <Editor value={"SEND 'hi' TO DISPLAY\n"} onChange={() => undefined} diagnostics={[]} />,
    );
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});

describe("MISC Editor language", () => {
  it("MISC colours Cambridge keywords when the language is cie", async () => {
    const screen = await render(
      <Editor value={"OUTPUT 1\n"} onChange={() => undefined} diagnostics={[]} language="cie" />,
    );
    await vi.waitFor(() => {
      const spans = [...screen.container.querySelectorAll(".cm-line span")].map((e) => e.textContent);
      expect(spans).toContain("OUTPUT");
    });
  });
});

describe("MISC Status bar wording and cursor", () => {
  it.each([
    ["idle", null, "Ready"],
    ["waiting", null, "Waiting for input"],
    ["finished", null, "Finished"],
    ["paused", 7, "Paused at line 7"],
    ["error", 3, "Error, line 3"],
    ["error", null, "Error"],
  ] as const)("MISC state %s with line %s reads %s", async (state, line, text) => {
    const screen = await render(<StatusBar state={state} line={line} diagnostics={[]} languageName="Python" />);
    await expect.element(screen.getByText(text, { exact: true })).toBeVisible();
  });

  it("MISC the status bar shows the cursor as Ln and Col", async () => {
    const screen = await render(
      <StatusBar state="idle" cursor={{ line: 4, column: 9 }} diagnostics={[]} languageName="Python" />,
    );
    await expect.element(screen.getByText("Ln 4, Col 9")).toBeVisible();
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});
