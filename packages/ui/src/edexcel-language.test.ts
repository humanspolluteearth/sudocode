import { StringStream } from "@codemirror/language";
import { describe, expect, it } from "vitest";
import { tokenEdexcel } from "./edexcel-language.ts";

/** The styles of every non-blank token on one line. */
function styles(line: string): (string | null)[] {
  const stream = new StringStream(line, 4, 2);
  const out: (string | null)[] = [];
  while (!stream.eol()) {
    const style = tokenEdexcel(stream);
    if (stream.current().trim() !== "") out.push(style);
    stream.start = stream.pos;
  }
  return out;
}

describe("MISC Edexcel editor colours", () => {
  it("MISC colours keywords, strings, numbers and names", () => {
    expect(styles('SEND "Hi" TO DISPLAY')).toEqual(["keyword", "string", "keyword", "keyword"]);
    expect(styles("SET total TO 3.5")).toEqual(["keyword", null, "keyword", "number"]);
  });
  it("MISC colours keywords written in lower case too", () => {
    expect(styles("set x to 1")).toEqual(["keyword", null, "keyword", "number"]);
  });
  it("MISC colours a # comment to the end of the line", () => {
    expect(styles("SET x TO 1 # one")).toEqual(["keyword", null, "keyword", "number", "comment"]);
  });
  it("MISC does not fail on an unclosed string", () => {
    expect(styles('SEND "oops')).toEqual(["keyword", "string"]);
  });
});
