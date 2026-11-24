import { describe, expect, it } from "vitest";
import {
  activeTab,
  closeTab,
  editActive,
  fileName,
  initialWorkspace,
  isDirty,
  markSaved,
  openTab,
  switchTab,
} from "./workspace.ts";

describe("MISC workspace of open files", () => {
  it("MISC starts with one saved tab named untitled", () => {
    const w = initialWorkspace("edexcel", "x");
    expect(w.tabs).toHaveLength(1);
    expect(fileName(activeTab(w))).toBe("untitled.epc");
    expect(isDirty(activeTab(w))).toBe(false);
  });

  it("MISC a new tab becomes active and gets a free name", () => {
    let w = initialWorkspace("python", "a");
    w = openTab(w, { name: "untitled", language: "python", source: "" });
    expect(fileName(activeTab(w))).toBe("untitled 2.py");
    expect(w.tabs).toHaveLength(2);
  });

  it("MISC editing makes the tab unsaved and saving clears it", () => {
    let w = editActive(initialWorkspace("cie", "a"), "b");
    expect(isDirty(activeTab(w))).toBe(true);
    w = markSaved(w, w.activeId, { name: "grades", language: "cie" });
    expect(isDirty(activeTab(w))).toBe(false);
    expect(fileName(activeTab(w))).toBe("grades.cpc");
  });

  it("MISC the last tab can't be closed; closing the active tab selects its neighbour", () => {
    let w = initialWorkspace("edexcel", "a");
    expect(closeTab(w, 1)).toBe(w);
    w = openTab(w, { name: "b", language: "edexcel", source: "b" });
    expect(closeTab(w, 2).activeId).toBe(1);
    expect(closeTab(switchTab(w, 1), 2).activeId).toBe(1);
  });
});
