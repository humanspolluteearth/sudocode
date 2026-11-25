// Keeping the student's comments (CNV-07).
//
// Compiler concept: the lexers throw comments away and the IR has no node for them, so the converter reads them
// straight from the source text and re-attaches each one to the first statement (or subprogram) on or after its line.
// That is a tiny *side table* keyed by IR node, which the printers read as they go.
import type { Program, Stmt } from "../../ir/ir.ts";

export interface Comment {
  line: number;
  text: string;
}

/** Comments in a source file: `#` text for Edexcel, `//` text for Cambridge. Quotes hide a marker. */
export function extractComments(source: string, marker: "#" | "//"): Comment[] {
  const found: Comment[] = [];
  source.split("\n").forEach((line, index) => {
    let quote = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i] ?? "";
      if (quote !== "") {
        if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (line.startsWith(marker, i)) {
        found.push({ line: index + 1, text: line.slice(i + marker.length).trim() });
        break;
      }
    }
  });
  return found;
}

export interface Attached {
  before: Map<object, string[]>;
  /** Comments after the last statement. */
  tail: string[];
}

/** Attaches each comment to the first statement or subprogram that starts on or after its line. */
export function attachComments(comments: Comment[], program: Program, write: (text: string) => string): Attached {
  const items: { line: number; node: object }[] = [];
  const visit = (body: Stmt[]): void => {
    for (const s of body) {
      items.push({ line: s.span.line, node: s });
      if ("body" in s && Array.isArray(s.body)) visit(s.body as Stmt[]);
      if (s.kind === "if") {
        visit(s.then);
        visit(s.else);
      }
    }
  };
  for (const sub of Object.values(program.subprograms)) {
    items.push({ line: sub.span.line, node: sub });
    visit(sub.body);
  }
  visit(program.main);
  const before = new Map<object, string[]>();
  const tail: string[] = [];
  for (const c of comments) {
    let best: { line: number; node: object } | null = null;
    for (const item of items) if (item.line >= c.line && (best === null || item.line < best.line)) best = item;
    if (best === null) tail.push(write(c.text));
    else before.set(best.node, [...(before.get(best.node) ?? []), write(c.text)]);
  }
  return { before, tail };
}

/** What the printers read: the comments to print before a node, and the ones left after the last statement. */
export interface Comments {
  before(node: object): string[];
  tail(): string[];
}

export function commentsOf(attached: Attached): Comments {
  return { before: (node) => attached.before.get(node) ?? [], tail: () => attached.tail };
}
