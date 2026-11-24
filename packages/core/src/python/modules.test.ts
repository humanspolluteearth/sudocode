import { describe, expect, it } from "vitest";
import { analyse } from "./engine.ts";
import { sha512 } from "../runtime/python/sha512.ts";
import { runHeadless } from "../runner/headless.ts";
import { createLocalRunner } from "../runner/local-runner.ts";
import { ENGINES } from "../runner/engines.ts";

async function out(source: string): Promise<string> {
  const r = await runHeadless(
    createLocalRunner(ENGINES),
    { language: "python", source, trace: false, breakpoints: [], files: {}, seed: 1 },
    [],
  );
  return r.stdout;
}

const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

describe("Python modules", () => {
  it("PY-41 sha512 matches the published digests (used to seed random from a string)", () => {
    const enc = new TextEncoder();
    expect(hex(sha512(enc.encode(""))).startsWith("cf83e1357eefb8bdf1542850d66d8007")).toBe(true);
    expect(hex(sha512(enc.encode("abc"))).startsWith("ddaf35a193617abacc417349ae204131")).toBe(true);
  });
  it("PY-22 importing a module that is not provided is not supported", () => {
    const codes = analyse("import os").diagnostics.map((d) => d.code);
    expect(codes.length).toBe(1);
  });
  it("PY-22 import as and from-import bind the names", async () => {
    expect(await out("import math as m\nfrom math import pi as p\nprint(m.floor(2.5), round(p, 2))")).toBe("2 3.14\n");
  });
  it("PY-22 a name that the module lacks is an ImportError", async () => {
    const r = await runHeadless(
      createLocalRunner(ENGINES),
      { language: "python", source: "from math import nope", trace: false, breakpoints: [], files: {}, seed: 1 },
      [],
    );
    expect(r.errors[0]?.code).toBe("E-PY-ImportError");
  });
  it("PY-40 floor, log with a base and trunc follow CPython", async () => {
    expect(await out("import math\nprint(math.floor(-2.5), math.log(8, 2), math.trunc(-2.7))")).toBe("-3 3.0 -2\n");
  });
  it("PY-41 seed(42) gives CPython's numbers", async () => {
    expect(await out("import random\nrandom.seed(42)\nprint(random.randint(1, 100), random.random())")).toBe(
      "82 0.11133106816568039\n",
    );
  });
  it("PY-42 date arithmetic crosses month and leap-year ends", async () => {
    expect(
      await out(
        "from datetime import date, timedelta\nprint(date(2024, 2, 28) + timedelta(days=2), date(2024, 3, 1) - date(2024, 2, 1))",
      ),
    ).toBe("2024-03-01 29 days, 0:00:00\n");
  });
  it("PY-43 time.sleep(0) returns and time.time() is a float", async () => {
    expect(await out("import time\ntime.sleep(0)\nprint(type(time.time()).__name__)")).toBe("float\n");
  });
});
