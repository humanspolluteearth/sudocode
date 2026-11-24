import { describe, expect, it } from "vitest";
import type { Expr, FileMode, Stmt } from "../ir/ir.ts";
import { at, global, num, print, program, set, text } from "../../tests/support/ir.ts";
import { run } from "../../tests/support/run-ir.ts";

// The Cambridge file statements (CIE-90 to CIE-97, CIE-130), run directly on the IR.
const F = (line: number): Expr => text("f.txt", line);
const open = (mode: FileMode, line: number): Stmt => ({ kind: "fileOpen", file: F(line), mode, span: at(line) });
const close = (line: number): Stmt => ({ kind: "fileClose", file: F(line), span: at(line) });
const write = (s: string, line: number): Stmt => ({
  kind: "fileWrite",
  file: F(line),
  strict: true,
  value: text(s, line),
  span: at(line),
});
const read = (line: number): Stmt => ({
  kind: "fileRead",
  file: F(line),
  strict: true,
  target: global("L", line),
  convert: "str",
  span: at(line),
});
const eof = (line: number): Expr => ({
  kind: "builtin",
  name: "eof",
  args: [F(line)],
  span: at(line),
});
const files = (o: { events: { type: string }[] }): Record<string, string> =>
  Object.fromEntries(
    o.events.flatMap((e) =>
      e.type === "fileWrite"
        ? [[(e as unknown as { name: string }).name, (e as unknown as { contents: string }).contents]]
        : [],
    ),
  );

describe("CIE-90 to CIE-93 text files", () => {
  it("CIE-91 WRITE loses old data and CIE-90 APPEND adds after it", async () => {
    const out = await run(
      program([open("write", 1), write("a", 2), close(3), open("append", 4), write("b", 5), close(6)]),
      { files: { "f.txt": "old\n" } },
    );
    expect(files(out)).toEqual({ "f.txt": "a\nb\n" });
    expect(out.errors).toEqual([]);
  });

  it("CIE-92 READFILE reads the lines in order and CIE-130 EOF turns TRUE after the last", async () => {
    const out = await run(
      program([
        open("read", 1),
        print(eof(2), 2),
        read(3),
        print(global("L", 4), 4),
        read(5),
        print(global("L", 6), 6),
        print(eof(7), 7),
        close(8),
      ]),
      { files: { "f.txt": "x\ny\n" } },
    );
    expect(out.stdout).toBe("FALSE\nx\ny\nTRUE\n");
  });

  it("CIE-130 EOF of an empty file is TRUE straight away", async () => {
    const out = await run(program([open("read", 1), print(eof(2), 2), close(3)]), { files: { "f.txt": "" } });
    expect(out.stdout).toBe("TRUE\n");
  });

  it("CIE-93 reading a file open for WRITE is E-RUN-FILE-MODE", async () => {
    const out = await run(program([open("write", 1), read(2)]));
    expect(out.errors).toEqual(["E-RUN-FILE-MODE 2"]);
  });

  it("CIE-93 writing a file open for READ is E-RUN-FILE-MODE", async () => {
    const out = await run(program([open("read", 1), write("a", 2)]), { files: { "f.txt": "x\n" } });
    expect(out.errors).toEqual(["E-RUN-FILE-MODE 2"]);
  });

  it("CIE-130 EOF on a file open for WRITE is E-RUN-FILE-MODE", async () => {
    const out = await run(program([open("write", 1), print(eof(2), 2)]));
    expect(out.errors).toEqual(["E-RUN-FILE-MODE 2"]);
  });

  it("CIE-93 reading past the end is E-RUN-READ-PAST-END", async () => {
    const out = await run(program([open("read", 1), read(2), read(3)]), { files: { "f.txt": "x\n" } });
    expect(out.errors).toEqual(["E-RUN-READ-PAST-END 3"]);
  });

  it("CIE-90 reading a file that was never opened is E-RUN-FILE-NOT-OPEN", async () => {
    const out = await run(program([read(1)]), { files: { "f.txt": "x\n" } });
    expect(out.errors).toEqual(["E-RUN-FILE-NOT-OPEN 1"]);
  });

  it("CIE-90 OPENFILE FOR READ of a missing file is E-RUN-FILE-NOT-FOUND", async () => {
    const out = await run(program([open("read", 1)]));
    expect(out.errors).toEqual(["E-RUN-FILE-NOT-FOUND 1"]);
  });

  it("CIE-91 opening a file that is already open is E-RUN-FILE-ALREADY-OPEN", async () => {
    const out = await run(program([open("write", 1), open("append", 2)]));
    expect(out.errors).toEqual(["E-RUN-FILE-ALREADY-OPEN 2"]);
  });

  it("CIE-90 the file name may be a STRING variable", async () => {
    const name = global("N", 2);
    const out = await run(
      program([
        set(name, text("f.txt", 1), 1),
        { kind: "fileOpen", file: name, mode: "write", span: at(2) },
        { kind: "fileWrite", file: name, strict: true, value: text("v", 3), span: at(3) },
        { kind: "fileClose", file: name, span: at(4) },
      ]),
    );
    expect(files(out)).toEqual({ "f.txt": "v\n" });
  });

  it("CIE-96 a file still open at the end is E-RUN-FILE-LEFT-OPEN at its OPENFILE", async () => {
    const out = await run(program([open("write", 1), write("a", 2)]));
    expect(out.errors).toEqual(["E-RUN-FILE-LEFT-OPEN 1"]);
  });

  it("CIE-96 a closed file is fine", async () => {
    const out = await run(program([open("write", 1), close(2), print(num(1), 3)]));
    expect(out.errors).toEqual([]);
  });
});

describe("CIE-94 to CIE-97 random files", () => {
  const seek = (n: number, line: number): Stmt => ({
    kind: "fileSeek",
    file: F(line),
    address: num(n, line),
    span: at(line),
  });
  const put = (v: string, line: number): Stmt => ({
    kind: "filePut",
    file: F(line),
    value: global(v, line),
    span: at(line),
  });
  const get = (v: string, line: number): Stmt => ({
    kind: "fileGet",
    file: F(line),
    target: global(v, line),
    span: at(line),
  });
  const setup: Stmt[] = [open("write", 1), close(2), open("random", 3)];

  it("CIE-94 a record put at address 2 reads back from address 2", async () => {
    const out = await run(
      program([
        set(global("R"), num(7)),
        ...setup,
        seek(2, 4),
        put("R", 5),
        seek(2, 6),
        get("S", 7),
        print(global("S", 8), 8),
        close(9),
      ]),
    );
    expect(out.stdout).toBe("7\n");
    expect(out.errors).toEqual([]);
  });

  it("CIE-94 PUTRECORD overwrites the record at that address", async () => {
    const out = await run(
      program([
        set(global("R"), num(1)),
        ...setup,
        seek(1, 4),
        put("R", 5),
        set(global("R", 6), num(2), 6),
        seek(1, 7),
        put("R", 8),
        seek(1, 9),
        get("S", 10),
        print(global("S", 11), 11),
        close(12),
      ]),
    );
    expect(out.stdout).toBe("2\n");
  });

  it("CIE-95 reading an empty slot is E-RUN-RECORD-EMPTY", async () => {
    const out = await run(program([...setup, seek(3, 4), get("S", 5)]));
    expect(out.errors).toEqual(["E-RUN-RECORD-EMPTY 5"]);
  });

  it("CIE-97 OPENFILE FOR RANDOM of a missing file is E-RUN-FILE-NOT-FOUND", async () => {
    const out = await run(program([open("random", 1)]));
    expect(out.errors).toEqual(["E-RUN-FILE-NOT-FOUND 1"]);
  });

  it("CIE-94 SEEK on a file open for READ is E-RUN-FILE-MODE", async () => {
    const out = await run(program([open("read", 1), seek(1, 2)]), { files: { "f.txt": "x\n" } });
    expect(out.errors).toEqual(["E-RUN-FILE-MODE 2"]);
  });
});
