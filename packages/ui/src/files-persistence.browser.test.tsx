import { describe, expect, it } from "vitest";
import { loadFiles, saveFiles } from "./files-store.ts";

describe("MISC files persist in IndexedDB", () => {
  it("MISC saved files come back, and the last save wins", async () => {
    await saveFiles({ "a.txt": "1\n" });
    await saveFiles({ "Scores.txt": "5\n7\n" });
    expect(await loadFiles()).toEqual({ "Scores.txt": "5\n7\n" });
  });
  it("MISC an empty store loads as no files", async () => {
    await saveFiles({});
    expect(await loadFiles()).toEqual({});
  });
});
