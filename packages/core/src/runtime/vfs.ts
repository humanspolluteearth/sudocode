// The virtual file system shared by both languages' file statements (SH-11, EDX-83, CIE-90..97, PY-21).
//
// Compiler concept: an *I/O effect* kept behind the machine. The program only says "read a line" or "write a
// line"; this table is the whole virtual file system, so the same program runs in Node, a Worker or a test. Names
// match without regard to case (SH-11); `name` remembers the spelling first used.
import type { Span } from "../diagnostics.ts";
import type { FileMode } from "../ir/ir.ts";
import type { VirtualFiles } from "../protocol.ts";
import { copyOf } from "./evaluate.ts";
import type { Machine } from "./interpreter.ts";
import { RunError } from "./run-error.ts";
import type { Value } from "./values.ts";

export type FileMachine = Pick<
  Machine,
  | "readLine"
  | "writeLine"
  | "openFile"
  | "closeFile"
  | "eof"
  | "seek"
  | "getRecord"
  | "putRecord"
  | "leftOpen"
  | "fileText"
  | "storeFile"
>;

/** `pendingFiles` collects each written file's whole new contents; the driver sends them out in batches. */
export function createFileMachine(files: VirtualFiles, pendingFiles: Map<string, string>): FileMachine {
  interface VFile {
    name: string;
    text: string;
    position: number;
    written: boolean;
    /** Set by OPENFILE (CIE-90); null for a file Edexcel code reads or writes without opening. */
    mode: FileMode | null;
    openedAt: Span | null;
    /** Random-file records (CIE-94); a hole is an empty slot (CIE-95). */
    records: (Value | undefined)[];
    address: number;
  }
  const store = new Map<string, VFile>();
  const fresh = (name: string, text: string, written: boolean): VFile => ({
    name,
    text,
    position: 0,
    written,
    mode: null,
    openedAt: null,
    records: [],
    address: 1,
  });
  for (const [name, text] of Object.entries(files)) store.set(name.toLowerCase(), fresh(name, text, false));
  const modeName = (m: FileMode | null): string => (m === null ? "closed" : m.toUpperCase());
  /** Cambridge files must be open in the right mode (CIE-93); `strict` is false for Edexcel's unopened files. */
  const need = (file: string, span: Span, modes: FileMode[], strict: boolean): VFile | undefined => {
    const f = store.get(file.toLowerCase());
    if (!strict) return f;
    if (f?.mode == null) throw new RunError("E-RUN-FILE-NOT-OPEN", span, { file });
    if (!modes.includes(f.mode)) throw new RunError("E-RUN-FILE-MODE", span, { file: f.name, mode: modeName(f.mode) });
    return f;
  };

  return {
    readLine: (file, span, strict = false) => {
      const f = need(file, span, ["read"], strict);
      if (f === undefined) throw new RunError("E-RUN-FILE-NOT-FOUND", span, { file });
      // Lines end with "\n" (or "\r\n"); a final newline does not start another, empty line.
      const lines = f.text === "" ? [] : f.text.replace(/\r?\n$/, "").split(/\r?\n/);
      const line = lines[f.position];
      if (line === undefined) throw new RunError("E-RUN-READ-PAST-END", span, { file: f.name });
      f.position++;
      return line;
    },
    writeLine: (file, text, span, strict = false) => {
      const key = file.toLowerCase();
      let f = need(file, span, ["write", "append"], strict);
      if (f === undefined) {
        f = fresh(file, "", true);
        store.set(key, f);
      } else if (!f.written) {
        f.text = ""; // EDX-83: the first WRITE of a run replaces the old contents
        f.written = true;
      }
      f.text += `${text}\n`;
      pendingFiles.set(f.name, f.text);
    },
    openFile: (file, mode, span) => {
      const key = file.toLowerCase();
      let f = store.get(key);
      if (f?.mode != null) throw new RunError("E-RUN-FILE-ALREADY-OPEN", span, { file: f.name });
      if (mode === "read" || mode === "random") {
        if (f === undefined) throw new RunError("E-RUN-FILE-NOT-FOUND", span, { file }); // CIE-97, SH-11
      } else if (f === undefined) {
        f = fresh(file, "", true);
        store.set(key, f);
      }
      if (mode === "write") {
        f.text = ""; // CIE-91: WRITE loses any old data
        f.records = [];
        pendingFiles.set(f.name, "");
      }
      f.written = true;
      f.mode = mode;
      f.openedAt = span;
      f.position = 0;
      f.address = 1;
    },
    closeFile: (file, span) => {
      const f = need(file, span, ["read", "write", "append", "random"], true);
      if (f !== undefined) {
        f.mode = null;
        f.openedAt = null;
      }
    },
    eof: (file, span) => {
      const f = need(file, span, ["read"], true);
      if (f === undefined) return true;
      const lines = f.text === "" ? 0 : f.text.replace(/\r?\n$/, "").split(/\r?\n/).length;
      return f.position >= lines;
    },
    seek: (file, address, span) => {
      const f = need(file, span, ["random"], true);
      if (f === undefined) return;
      if (address < 1) throw new RunError("E-RUN-RECORD-EMPTY", span, { file: f.name, address });
      f.address = address;
    },
    getRecord: (file, span) => {
      const f = need(file, span, ["random"], true);
      const v = f?.records[f.address - 1];
      if (f === undefined || v === undefined)
        throw new RunError("E-RUN-RECORD-EMPTY", span, { file: f?.name ?? file, address: f?.address ?? 0 });
      return copyOf(v);
    },
    putRecord: (file, value, span) => {
      const f = need(file, span, ["random"], true);
      if (f !== undefined) f.records[f.address - 1] = copyOf(value);
    },
    leftOpen: () => {
      for (const f of store.values())
        if (f.mode !== null && f.openedAt !== null) return { file: f.name, span: f.openedAt };
      return null;
    },
    fileText: (name) => store.get(name.toLowerCase())?.text,
    storeFile: (name, text) => {
      const key = name.toLowerCase();
      const f = store.get(key) ?? fresh(name, "", true);
      f.text = text;
      f.written = true;
      store.set(key, f);
      pendingFiles.set(f.name, text);
    },
  };
}
