import { describe, expect, it } from "vitest";
import { applyWrite, findName, putFile, removeFile, validName } from "./files-store.ts";

describe("SH-11 file names are matched without regard to case (SH-11)", () => {
  it("SH-11 finds Scores.txt by scores.TXT", () => {
    expect(findName({ "Scores.txt": "1" }, "scores.TXT")).toBe("Scores.txt");
  });
  it("SH-11 a write to another case replaces the same file", () => {
    expect(applyWrite({ "Scores.txt": "old" }, "SCORES.txt", "new")).toEqual({ "Scores.txt": "new" });
  });
});

describe("MISC the Files panel's store", () => {
  it("MISC putFile creates and replaces", () => {
    expect(putFile(putFile({}, "a.txt", "1"), "a.txt", "2")).toEqual({ "a.txt": "2" });
  });
  it("MISC removeFile deletes in any case", () => {
    expect(removeFile({ "A.txt": "1", "b.txt": "2" }, "a.TXT")).toEqual({ "b.txt": "2" });
  });
  it("MISC validName allows letters, digits, dot, dash and underscore only", () => {
    expect(validName("Scores_1.txt")).toBe(true);
    expect(validName("a b.txt")).toBe(false);
    expect(validName("")).toBe(false);
  });
});
