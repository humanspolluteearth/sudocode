// Python text files on the virtual file system (PY-21): open(), the file methods, and iteration.
//
// Compiler concept: an *I/O effect* kept behind the machine. A file value only remembers where its reading has got
// to; every write goes through `machine.storeFile`, so the same program runs in Node, a Worker or a test.
import type { Span } from "../../diagnostics.ts";
import type { Machine } from "../evaluate.ts";
import { NONE, pyint, str, type Value } from "../values.ts";
import { pyError, typeError, valueError } from "./errors.ts";
import { iterate } from "./seq.ts";
import { pyRepr, pyTypeName } from "./repr.ts";
import { setOrder } from "./hash.ts";
import type { CallArgs } from "./methods-str.ts";

type FileValue = Extract<Value, { kind: "file" }>;

export function openFile(args: Value[], kwargs: Map<string, Value>, machine: Machine, span: Span): Value {
  const nameArg = args[0] ?? kwargs.get("file");
  const modeArg = args[1] ?? kwargs.get("mode");
  if (nameArg === undefined) throw typeError("open() missing required argument 'file' (pos 1)", span);
  if (nameArg.kind !== "str")
    throw typeError("expected str, bytes or os.PathLike object, not " + pyTypeName(nameArg), span);
  if (modeArg !== undefined && modeArg.kind !== "str")
    throw typeError(`open() argument 'mode' must be str, not ${pyTypeName(modeArg)}`, span);
  const mode = modeArg === undefined ? "r" : modeArg.value;
  if (mode !== "r" && mode !== "w" && mode !== "a") throw valueError(badMode(mode), span);
  const name = nameArg.value;
  const existing = machine.fileText(name);
  if (mode === "r") {
    if (existing === undefined)
      throw pyError("FileNotFoundError", `[Errno 2] No such file or directory: ${pyRepr(nameArg, setOrder)}`, span);
  } else if (mode === "w" || existing === undefined) machine.storeFile(name, ""); // "w" empties it; "a" creates it
  return { kind: "file", name, mode, text: mode === "r" ? (existing ?? "") : "", pos: 0, closed: false };
}

/** What iterating a file gives: the lines still unread, each with its newline. */
export function fileLines(f: FileValue, span: Span): Value[] {
  needOpen(f, span);
  needMode(f, "r", "not readable", span);
  const lines = takeLines(f, Infinity);
  return lines.map((l) => str(l));
}

// CPython's two wordings: an unknown letter, or not exactly one of read/write/append (e.g. "rw" or "").
function badMode(mode: string): string {
  const known = Array.from(mode).every((c) => "rwxabt+".includes(c));
  const kinds = Array.from(mode).filter((c) => "rwxa".includes(c)).length;
  return known && kinds !== 1
    ? "must have exactly one of create/read/write/append mode"
    : `invalid mode: ${pyRepr(str(mode), setOrder)}`;
}

function needOpen(f: FileValue, span: Span): void {
  if (f.closed) throw valueError("I/O operation on closed file.", span);
}

function needMode(f: FileValue, mode: "r" | "w", what: string, span: Span): void {
  const ok = mode === "r" ? f.mode === "r" : f.mode !== "r";
  if (!ok) throw pyError("UnsupportedOperation", what, span);
}

function takeLines(f: FileValue, count: number): string[] {
  const out: string[] = [];
  while (out.length < count && f.pos < f.text.length) {
    const nl = f.text.indexOf("\n", f.pos);
    const end = nl === -1 ? f.text.length : nl + 1;
    out.push(f.text.slice(f.pos, end));
    f.pos = end;
  }
  return out;
}

function append(f: FileValue, text: string, machine: Machine): void {
  machine.storeFile(f.name, (machine.fileText(f.name) ?? "") + text);
}

export function fileMethod(f: FileValue, name: string, ca: CallArgs, machine: Machine, span: Span): Value | undefined {
  const a0 = ca.args[0];
  switch (name) {
    case "close":
      f.closed = true;
      return NONE;
    case "read": {
      needOpen(f, span);
      needMode(f, "r", "not readable", span);
      const rest = f.text.slice(f.pos);
      f.pos = f.text.length;
      return str(rest);
    }
    case "readline":
      needOpen(f, span);
      needMode(f, "r", "not readable", span);
      return str(takeLines(f, 1)[0] ?? "");
    case "readlines":
      return { kind: "list", items: fileLines(f, span) };
    case "write": {
      needOpen(f, span);
      needMode(f, "w", "not writable", span);
      if (a0 === undefined || a0.kind !== "str")
        throw typeError(`write() argument must be str, not ${a0 === undefined ? "None" : pyTypeName(a0)}`, span);
      append(f, a0.value, machine);
      return pyint(BigInt(a0.value.length));
    }
    case "writelines": {
      needOpen(f, span);
      needMode(f, "w", "not writable", span);
      let text = "";
      for (const item of iterate(a0 ?? NONE, span)) {
        if (item.kind !== "str") throw typeError(`write() argument must be str, not ${pyTypeName(item)}`, span);
        text += item.value;
      }
      append(f, text, machine);
      return NONE;
    }
    default:
      return undefined;
  }
}
