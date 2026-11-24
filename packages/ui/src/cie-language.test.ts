import { StringStream } from "@codemirror/language";
import { describe, expect, it } from "vitest";
import { tokenCie } from "./cie-language.ts";

function styles(line: string): (string | null)[] {
  const stream = new StringStream(line, 4, 2);
  const out: (string | null)[] = [];
  while (!stream.eol()) {
    const style = tokenCie(stream);
    if (stream.current().trim() !== "") out.push(style);
    stream.start = stream.pos;
  }
  return out;
}

describe("MISC Cambridge editor colours", () => {
  it("MISC colours a declaration: keyword, name, symbol, type", () => {
    expect(styles("DECLARE Total : INTEGER")).toEqual(["keyword", null, null, "typeName"]);
  });
  it("MISC colours OUTPUT with a string and a built-in", () => {
    expect(styles('OUTPUT "Hi", LENGTH(Name)')).toEqual(["keyword", "string", null, "builtin", null, null, null]);
  });
  it("MISC colours class keywords", () => {
    expect(styles("CLASS Dog INHERITS Animal")).toEqual(["keyword", null, "keyword", null]);
  });
  it("MISC colours a // comment to the end of the line", () => {
    expect(styles("X ← 1 // one")).toEqual([null, null, "number", "comment"]);
  });
  it("MISC colours lower-case keywords too, and does not fail on an unclosed string", () => {
    expect(styles("if x then")).toEqual(["keyword", null, "keyword"]);
    expect(styles('OUTPUT "oops')).toEqual(["keyword", "string"]);
  });
});
