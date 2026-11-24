import { describe, expect, it } from "vitest";
import { cleanName, parseFileName } from "./file-io.ts";

describe("MISC file names for Save and Open", () => {
  it.each([
    ["grades", "grades"],
    ["  grades.epc ", "grades"],
    ["my/file:name.py", "my-file-name"],
    ["", "untitled"],
    [".py", "untitled"],
  ])("MISC cleanName(%j) is %j", (raw, expected) => {
    expect(cleanName(raw)).toBe(expected);
  });

  it.each([
    ["a.epc", "edexcel", { name: "a", language: "edexcel" }],
    ["a.CPC", "python", { name: "a", language: "cie" }],
    ["a.py", "edexcel", { name: "a", language: "python" }],
    ["notes.txt", "cie", { name: "notes", language: "cie" }],
  ] as const)("MISC parseFileName(%j) picks the language from the type", (file, fallback, expected) => {
    expect(parseFileName(file, fallback)).toEqual(expected);
  });
});
