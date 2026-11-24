import { StringStream } from "@codemirror/language";
import { describe, expect, it } from "vitest";
import { tokenPython } from "./python-language.ts";

function styles(line: string): (string | null)[] {
  const stream = new StringStream(line, 4, 2);
  const out: (string | null)[] = [];
  while (!stream.eol()) {
    stream.start = stream.pos;
    out.push(tokenPython(stream));
  }
  return out.filter((s) => s !== null);
}

describe("MISC Python highlighting", () => {
  it("MISC colours keywords, built-ins, literals, numbers, strings and comments", () => {
    expect(styles('if x: print("a") # hi')).toEqual(["keyword", "builtin", "string", "comment"]);
    expect(styles("y = None + 3")).toEqual(["bool", "number"]);
  });
});
