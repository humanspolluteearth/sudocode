import { render } from "vitest-browser-react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { axeViolations } from "./axe.ts";
import { Editor, type EditorHandle } from "./Editor.tsx";
import { filterSnippets, QuickReference, SNIPPETS } from "./QuickReference.tsx";
import type { GuideId } from "./GuidePage.tsx";
import { createRef } from "react";

const LANGS: GuideId[] = ["edexcel", "cie", "python"];

describe("MISC Quick reference snippets", () => {
  it.each(LANGS)("MISC %s lists every section of the design", async (language) => {
    const screen = await render(<QuickReference language={language} onInsert={() => undefined} />);
    for (const g of SNIPPETS[language]) {
      await expect.element(screen.getByRole("heading", { name: g.section })).toBeVisible();
    }
  });

  it.each(LANGS)("MISC %s has an Insert button on every snippet except the noInsert ones", async (language) => {
    const screen = await render(<QuickReference language={language} onInsert={() => undefined} />);
    const items = SNIPPETS[language].flatMap((g) => g.items);
    const insertable = items.filter((it) => it.noInsert !== true);
    expect(insertable.length).toBeGreaterThan(0);
    expect(insertable.length).toBeLessThan(items.length + 1);
    expect(screen.container.querySelectorAll("button.sc-ref-insert")).toHaveLength(insertable.length);
    for (const it of items.filter((x) => x.noInsert === true)) {
      expect(screen.container.querySelector(`button[aria-label="Insert ${it.title} at the cursor"]`)).toBeNull();
    }
  });

  it("MISC Insert passes the snippet's code to the editor", async () => {
    const onInsert = vi.fn();
    const screen = await render(<QuickReference language="python" onInsert={onInsert} />);
    const first = SNIPPETS.python.flatMap((g) => g.items).find((it) => it.noInsert !== true);
    if (first === undefined) throw new Error("no insertable snippet");
    await screen.getByRole("button", { name: `Insert ${first.title} at the cursor` }).click();
    expect(onInsert).toHaveBeenCalledWith(first.code);
  });

  it("MISC Find narrows the list and says 'No matches.' when nothing fits", async () => {
    const screen = await render(<QuickReference language="cie" onInsert={() => undefined} />);
    await userEvent.fill(screen.getByRole("searchbox", { name: "Find" }), "zzzqqq");
    await expect.element(screen.getByText("No matches.")).toBeVisible();
    expect(screen.container.querySelectorAll("article")).toHaveLength(0);
    await userEvent.fill(screen.getByRole("searchbox", { name: "Find" }), "CASE");
    expect(screen.container.querySelectorAll("article").length).toBeGreaterThan(0);
  });

  it("MISC filterSnippets matches the section, title, code or note, ignoring case", () => {
    const sections = [{ section: "Loops", items: [{ title: "WHILE", code: "x", note: "checks first" }] }];
    expect(filterSnippets(sections, "loops")).toHaveLength(1);
    expect(filterSnippets(sections, " CHECKS ")).toHaveLength(1);
    expect(filterSnippets(sections, "nothing")).toEqual([]);
    expect(filterSnippets(sections, "")).toEqual(sections);
  });

  it("MISC Insert types the snippet at the editor's cursor, not at the end", async () => {
    const handle = createRef<EditorHandle>();
    let value = "AB\nCD";
    const screen = await render(
      <Editor ref={handle} value={value} onChange={(v) => (value = v)} diagnostics={[]} language="python" />,
    );
    handle.current?.goTo(1, 2);
    handle.current?.insertAtCursor("xy");
    await vi.waitFor(() => {
      expect(value).toBe("AxyB\nCD");
    });
    await screen.unmount();
  });

  it.each(LANGS)("MISC %s Quick reference has no axe violations", async (language) => {
    const screen = await render(<QuickReference language={language} onInsert={() => undefined} />);
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});
