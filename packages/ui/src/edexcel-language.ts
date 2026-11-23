// Syntax highlighting for Edexcel pseudocode in the editor.
//
// Compiler concept: *lexical highlighting*. The editor colours text by a quick, forgiving scan (a "stream" tokenizer
// that looks at one line at a time) instead of the real lexer: it must never fail and must be fast on every key press.
// The real lexer in packages/core decides what the program means; this one only decides colours.
import { HighlightStyle, StreamLanguage, syntaxHighlighting, type StringStream } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/** Keywords and the standard devices, from docs/language-spec/edexcel.md (written in any case, EDX-05). */
const KEYWORDS: ReadonlySet<string> = new Set([
  "SET",
  "TO",
  "SEND",
  "DISPLAY",
  "RECEIVE",
  "FROM",
  "KEYBOARD",
  "IF",
  "THEN",
  "ELSE",
  "END",
  "WHILE",
  "DO",
  "REPEAT",
  "UNTIL",
  "TIMES",
  "FOR",
  "EACH",
  "FOREACH",
  "STEP",
  "PROCEDURE",
  "FUNCTION",
  "BEGIN",
  "RETURN",
  "AND",
  "OR",
  "NOT",
  "MOD",
  "DIV",
  "ENDIF",
  "CONST",
  "ARRAY",
  "OPEN",
  "CLOSE",
  "READ",
  "WRITE",
  "IN",
]);
const TYPES: ReadonlySet<string> = new Set(["INTEGER", "REAL", "STRING", "BOOLEAN", "CHARACTER", "DATE"]);
const BUILT_INS: ReadonlySet<string> = new Set(["LENGTH", "RANDOM"]);
const LITERALS: ReadonlySet<string> = new Set(["TRUE", "FALSE"]);

/** Reads one token from the line and returns its style name, or null for plain text. */
export function tokenEdexcel(stream: StringStream): string | null {
  if (stream.eatSpace()) return null;
  if (stream.match("#")) {
    stream.skipToEnd();
    return "comment";
  }
  const quote = stream.peek();
  if (quote === '"' || quote === "'") {
    stream.next();
    // An unclosed string runs to the line end.
    while (!stream.eol()) if (stream.next() === quote) break;
    return "string";
  }
  if (stream.match(/^\d+(\.\d+)?/)) return "number";
  if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
    const word = stream.current().toUpperCase();
    if (KEYWORDS.has(word)) return "keyword";
    if (TYPES.has(word)) return "typeName";
    if (BUILT_INS.has(word)) return "builtin";
    if (LITERALS.has(word)) return "bool";
    return null;
  }
  stream.next();
  return null;
}

export const edexcelLanguage = StreamLanguage.define<null>({
  name: "edexcel",
  startState: () => null,
  token: tokenEdexcel,
  languageData: { commentTokens: { line: "#" } },
  tokenTable: { builtin: tags.standard(tags.variableName), bool: tags.bool, typeName: tags.typeName },
});

/** Colours come from the theme's CSS variables, so light and dark need no second style. */
export const edexcelHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: "var(--kw)", fontWeight: "600" },
    { tag: tags.string, color: "var(--str)" },
    { tag: tags.number, color: "var(--num)" },
    { tag: tags.comment, color: "var(--comment)", fontStyle: "italic" },
    { tag: [tags.typeName, tags.standard(tags.variableName)], color: "var(--bi)" },
    { tag: tags.bool, color: "var(--num)" },
  ]),
);
