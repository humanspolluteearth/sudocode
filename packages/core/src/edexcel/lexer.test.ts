import { describe, expect, it } from "vitest";
import { lex } from "./lexer.ts";

const kinds = (source: string): string[] => lex(source).tokens.map((t) => `${t.kind}:${t.text}`);
const at = (source: string): string[] =>
  lex(source).tokens.map((t) => `${t.text === "\n" ? "NL" : t.text}@${String(t.span.line)}:${String(t.span.column)}`);
const problems = (source: string): string[] =>
  lex(source).diagnostics.map((d) => `${d.code} ${String(d.line)}:${String(d.column)}`);

describe("EDX-02 to EDX-10 Edexcel tokens", () => {
  it("EDX-04 keywords and names are both words; the parser decides which is which", () => {
    expect(kinds("SET total TO 5")).toEqual(["word:SET", "word:total", "word:TO", "int:5", "newline:\n", "eof:"]);
  });

  it("EDX-02 names use letters, digits and _, starting with a letter", () => {
    expect(kinds("my_score2")).toEqual(["word:my_score2", "newline:\n", "eof:"]);
  });

  it.each([
    ["_total", "E-SYN-BAD-NAME 1:1"],
    ["2nd", "E-SYN-BAD-NAME 1:1"],
  ])("EDX-02 %s can't be a name: one error token and one error", (source, problem) => {
    expect(kinds(source)).toEqual([`error:${source}`, "newline:\n", "eof:"]);
    expect(problems(source)).toEqual([problem]);
  });

  it("EDX-08 number literals: INTEGER and REAL", () => {
    expect(kinds("42 3.14 0.5")).toEqual(["int:42", "real:3.14", "real:0.5", "newline:\n", "eof:"]);
  });

  it.each(["3.", "1.2.3"])("EDX-08 %s is not a number", (source) => {
    expect(kinds(source)).toEqual([`error:${source}`, "newline:\n", "eof:"]);
    expect(problems(source)).toEqual(["E-SYN-BAD-NUMBER 1:1"]);
  });

  it("EDX-34 symbols, including the two-character comparisons", () => {
    expect(kinds("a<>b<=c>=d<e>f=g+-*/^&()[],:")).toEqual([
      "word:a",
      "symbol:<>",
      "word:b",
      "symbol:<=",
      "word:c",
      "symbol:>=",
      "word:d",
      "symbol:<",
      "word:e",
      "symbol:>",
      "word:f",
      ...["=", "g", "+", "-", "*", "/", "^", "&", "(", ")", "[", "]", ",", ":"].map((s) =>
        s === "g" ? "word:g" : `symbol:${s}`,
      ),
      "newline:\n",
      "eof:",
    ]);
  });

  it("EDX-32 != and == are errors with a one-click fix, and still read as <> and =", () => {
    const result = lex("1 != 2 == 3");
    expect(result.tokens.map((t) => t.text)).toEqual(["1", "<>", "2", "=", "3", "\n", ""]);
    expect(result.diagnostics.map((d) => [d.code, d.column, d.fix?.edits])).toEqual([
      ["E-SYN-NOT-EQUAL", 3, [{ start: 2, end: 4, replacement: "<>" }]],
      ["E-SYN-DOUBLE-EQUALS", 8, [{ start: 7, end: 9, replacement: "=" }]],
    ]);
  });

  it("SH-15 a character Sudocode doesn't know is an error, and lexing carries on", () => {
    expect(kinds("x @ y")).toEqual(["word:x", "error:@", "word:y", "newline:\n", "eof:"]);
    expect(problems("x @ y")).toEqual(["E-SYN-UNEXPECTED-CHAR 1:3"]);
  });
});

describe("EDX-01, EDX-06 and EDX-07 comments and strings", () => {
  it("EDX-01 # starts a comment to the end of the line, also straight after code", () => {
    expect(kinds("SET x TO 5 # set x\nSEND x TO DISPLAY#no space")).toEqual([
      ...["word:SET", "word:x", "word:TO", "int:5", "newline:\n"],
      ...["word:SEND", "word:x", "word:TO", "word:DISPLAY", "newline:\n", "eof:"],
    ]);
  });

  it("EDX-01 a # inside quotes is text", () => {
    expect(lex("'a # b'").tokens[0]).toMatchObject({ kind: "string", value: "a # b", quote: "single" });
  });

  it("EDX-06 single and curly quotes make strings, and any of them closes one", () => {
    const values = lex("'Hello' ‘Curly’ ‘Mixed' 'say \"hi\"'").tokens.map((t) => t.value);
    expect(values).toEqual(["Hello", "Curly", "Mixed", 'say "hi"', undefined, undefined]);
    expect(problems("'Hello' ‘Curly’")).toEqual([]);
  });

  it("EDX-06 a string with no closing quote on its line is an error at the opening quote", () => {
    expect(kinds("SEND 'Hello TO DISPLAY\nSET x TO 1")[1]).toBe("error:'Hello TO DISPLAY");
    expect(problems("SEND 'Hello TO DISPLAY\nSET x TO 1")).toEqual(["E-SYN-UNCLOSED-STRING 1:6"]);
  });

  it("EDX-07 double quotes make a string with a warning at the opening quote and a fix to single quotes", () => {
    const result = lex('SEND "It\'s" TO DISPLAY');
    expect(result.tokens[1]).toMatchObject({ kind: "string", value: "It's", quote: "double" });
    expect(result.diagnostics.map((d) => [d.code, d.column, d.hint, d.fix?.edits])).toEqual([
      [
        "W-EDX-DOUBLE-QUOTES",
        6,
        "Write 'It's'.",
        [
          { start: 5, end: 6, replacement: "'" },
          { start: 10, end: 11, replacement: "'" },
        ],
      ],
    ]);
  });
});

describe("SH-01 lines, columns and encodings", () => {
  it("SH-01 \\r\\n and \\n both end a line; columns are the same either way", () => {
    expect(at("SET x\r\nSEND y\n")).toEqual(["SET@1:1", "x@1:5", "NL@1:6", "SEND@2:1", "y@2:6", "NL@2:7", "@3:1"]);
    expect(at("SET x\nSEND y\n")).toEqual(["SET@1:1", "x@1:5", "NL@1:6", "SEND@2:1", "y@2:6", "NL@2:7", "@3:1"]);
  });

  it("SH-01 columns count characters, so an emoji is one column; offsets stay UTF-16", () => {
    const tokens = lex("'😀😀' & x").tokens;
    expect(tokens.map((t) => [t.text, t.span.column, t.span.start])).toEqual([
      ["'😀😀'", 1, 0],
      ["&", 6, 7],
      ["x", 8, 9],
      ["\n", 9, 10],
      ["", 9, 10],
    ]);
  });

  it("SH-01 a byte order mark at the start is not part of line 1", () => {
    expect(at("﻿SEND 1")).toEqual(["SEND@1:1", "1@1:6", "NL@1:7", "@1:7"]);
  });

  it("EDX-09 the end of a line is reported just after its last token, not after a comment or spaces", () => {
    expect(at("IF x   # check\n")).toEqual(["IF@1:1", "x@1:4", "NL@1:5", "@2:1"]);
  });

  it("MISC a program without a final newline still ends its last line", () => {
    expect(kinds("SEND 1")).toEqual(["word:SEND", "int:1", "newline:\n", "eof:"]);
    expect(kinds("")).toEqual(["eof:"]);
  });

  it("MISC a lone \\r is just a space", () => {
    expect(at("SET\rx")).toEqual(["SET@1:1", "x@1:5", "NL@1:6", "@1:6"]);
  });
});
