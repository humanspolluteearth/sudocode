// Refusing what we cannot translate faithfully (M10).
//
// Compiler concept: a *back end* may only print what it can print correctly. Before printing, we walk the whole IR once
// and look for nodes that have no honest Python equivalent (files, records, classes, TRY, BYREF, dates, devices). The
// first one in the source is reported with a message written for a student; nothing is ever silently changed.
import type { Program } from "../ir/ir.ts";

export type RefusedFeature = "files" | "types" | "classes" | "errors" | "byref" | "dates" | "devices" | "problems";

/** Only the pseudocode-to-pseudocode printers (converter/pseudo/) refuse the extra ones. */
export type PseudoFeature =
  | RefusedFeature
  | "builtins"
  | "prompt"
  | "multi-array"
  | "growing-array"
  | "real-in-text"
  | "unknown-type"
  | "name-clash";

export interface Refusal {
  feature: RefusedFeature;
  line: number;
  column: number;
}

type Words = { message: string; hint: string };

const WORDS: Record<PseudoFeature, Words> = {
  files: {
    message: "This program reads or writes files, and Sudocode can't turn that into Python yet.",
    hint: "Python opens and closes files in its own way, so this needs a person to do it. Everything else could be converted if you take the file lines out.",
  },
  types: {
    message:
      "This program uses records, enumerated types or other new types, and Sudocode can't turn those into Python yet.",
    hint: "Python builds these in a different way (classes). Try converting a version of the program that only uses variables and arrays.",
  },
  classes: {
    message: "This program uses classes and objects, and Sudocode can't turn those into Python yet.",
    hint: "Python classes look different from pseudocode classes, so they need to be written by hand.",
  },
  errors: {
    message: "This program uses TRY and EXCEPT, and Sudocode can't turn that into Python yet.",
    hint: "Python handles errors with its own try/except rules, which are not the same. Try converting without the TRY part.",
  },
  byref: {
    message: "This program passes a value BYREF, and Sudocode can't turn that into Python yet.",
    hint: "Python can't change a variable that you pass in. A function that returns the new value does the same job.",
  },
  dates: {
    message:
      "This program uses dates (TODAY, DAY, MONTH, YEAR and so on), and Sudocode can't turn them into Python yet.",
    hint: "Python keeps dates in a module called datetime, which works differently.",
  },
  devices: {
    message: "This program sends to, or receives from, a device other than the screen and keyboard.",
    hint: "Python has no motors, lights or sensors built in, so this line has no Python version.",
  },
  problems: {
    message: "This program has errors, so it can't be converted.",
    hint: "Fix the problems shown in red first, then convert again.",
  },
  builtins: {
    message: "This program uses a built-in function that the other language doesn't have.",
    hint: "Write the same job with your own lines, then convert again.",
  },
  prompt: {
    message: "This INPUT shows a prompt. The other language can't ask a question and wait on the same line.",
    hint: "Put the question in its own OUTPUT or SEND line, and make the input a plain INPUT or RECEIVE.",
  },
  "multi-array": {
    message: "This program uses a table (an array with two dimensions), and Sudocode can't convert those yet.",
    hint: "A list with one dimension converts fine. Try that, or rewrite this part by hand.",
  },
  "growing-array": {
    message: "This array changes its size or is used in a way the other language can't copy.",
    hint: "Make the array as big as you need when you create it, then only change the items inside it.",
  },
  "real-in-text": {
    message: "A decimal number (REAL) is joined to text here. The other language might print it differently.",
    hint: "Print the number on its own line instead of joining it to text.",
  },
  "unknown-type": {
    message: "Sudocode can't tell what kind of value this name holds, and the other language needs to know.",
    hint: "Give the name a value near the top of the program, such as 0, '' or FALSE, then convert again.",
  },
  "name-clash": {
    message: "Two names here differ only by capital letters, and the other language treats them as the same name.",
    hint: "Rename one of them so they look different, then convert again.",
  },
};

/** The words for a refusal. `detail` names the construct (a builtin, a variable) when the message should say it. */
export function refusalWords(feature: PseudoFeature, detail?: string): Words {
  const words = WORDS[feature];
  if (detail === undefined) return words;
  if (feature === "builtins")
    return { message: `${detail} is a built-in function that the other language doesn't have.`, hint: words.hint };
  if (feature === "unknown-type")
    return {
      message: `Sudocode can't tell what kind of value ${detail} holds, and the other language needs to know.`,
      hint: words.hint,
    };
  if (feature === "name-clash") return { message: detail, hint: words.hint };
  return words;
}

const DATE_BUILTINS = new Set(["day", "month", "year", "dayIndex", "setDate", "today"]);

function featureOf(node: { kind: string; [key: string]: unknown }): RefusedFeature | null {
  switch (node.kind) {
    case "fileRead":
    case "fileWrite":
    case "fileOpen":
    case "fileClose":
    case "fileSeek":
    case "fileGet":
    case "filePut":
      return "files";
    case "newRecord":
    case "field":
    case "enumValue":
    case "enumStep":
    case "enumOrdinal":
      return "types";
    case "tryCatch":
      return "errors";
    case "builtin":
      if (node["name"] === "eof") return "files";
      return DATE_BUILTINS.has(String(node["name"])) ? "dates" : null;
    case "output":
    case "input":
      return node["device"] === null || node["device"] === undefined ? null : "devices";
    case "callStatement":
      return Array.isArray(node["outs"]) && node["outs"].some((o) => o !== null) ? "byref" : null;
    case "fail":
      return "problems";
    default:
      return node.kind.startsWith("py") ? "problems" : null;
  }
}

/** Finds the earliest unsupported node, in source order, or null when everything can be printed. */
export function findRefusal(program: Program): Refusal | null {
  let best: Refusal | null = null;
  const note = (feature: RefusedFeature, span: { line: number; column: number } | undefined): void => {
    const line = span?.line ?? 1;
    const column = span?.column ?? 1;
    if (best === null || line < best.line || (line === best.line && column < best.column)) {
      best = { feature, line, column };
    }
  };
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const node = value as { kind?: unknown; span?: { line: number; column: number } };
    if (typeof node.kind === "string") {
      const feature = featureOf(node as { kind: string });
      if (feature !== null) note(feature, node.span);
    }
    for (const child of Object.values(value)) if (child !== node.span) walk(child);
  };
  walk(program.main);
  for (const sub of Object.values(program.subprograms)) {
    // A class method is a subprogram called `Class#method`, and `new Class` builds an object (cie/classes.ts).
    if (sub.name.includes("#") || sub.name.includes(".") || sub.name.startsWith("new ")) note("classes", sub.span);
    if (sub.byRef?.some(Boolean) === true) note("byref", sub.span);
    walk(sub.body);
  }
  return best;
}
