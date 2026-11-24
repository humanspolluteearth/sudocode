import { describe, expect, it } from "vitest";
import { analyse } from "./engine.ts";
import { runHeadless } from "../runner/headless.ts";
import { createLocalRunner } from "../runner/local-runner.ts";
import { ENGINES } from "../runner/engines.ts";

const codes = (source: string): string[] =>
  analyse(source).diagnostics.map((d) => `${d.code} ${String(d.line)}:${String(d.column)}`);

async function out(source: string): Promise<string> {
  const r = await runHeadless(
    createLocalRunner(ENGINES),
    { language: "python", source, trace: false, breakpoints: [], files: {} },
    [],
  );
  return r.stdout;
}

describe("Python front end", () => {
  it("PY-04 a missing colon is a SyntaxError at the end of the line", () => {
    expect(codes("if True\n    print(1)")).toEqual(["E-PY-SyntaxError 1:8"]);
  });
  it("PY-04 an unindented body is an IndentationError", () => {
    expect(codes("if True:\nprint(1)")).toEqual(["E-PY-IndentationError 2:1"]);
  });
  it("PY-04 return outside a function is a SyntaxError", () => {
    expect(codes("return 1")).toEqual(["E-PY-SyntaxError 1:1"]);
  });
  it("PY-04 break outside a loop is a SyntaxError", () => {
    expect(codes("break")).toEqual(["E-PY-SyntaxError 1:1"]);
  });
  it("PY-04 assigning to a literal is a SyntaxError", () => {
    expect(codes("1 = x")).toEqual(["E-PY-SyntaxError 1:1"]);
  });
});

describe("Python behaves like CPython 3.12", () => {
  it("PY-01 int is unlimited and // and % floor", async () => {
    expect(await out("print(2**100, 7//-2, -7%3)")).toBe("1267650600228229401496703205376 -4 2\n");
  });
  it("PY-01 floats print their shortest repr and round() is banker's", async () => {
    expect(await out("print(0.1+0.2, 1e16, 10/4, round(2.5))")).toBe("0.30000000000000004 1e+16 2.5 2\n");
  });
  it("PY-01 f-string format specs", async () => {
    expect(await out("print(f'{3.14159:.2f}|{42:>5}|{255:x}')")).toBe("3.14|   42|ff\n");
  });
});
