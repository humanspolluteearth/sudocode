import { describe, expect, it } from "vitest";
import { createLocalRunner, ENGINES } from "../engine.ts";
import { runHeadless } from "../runner/headless.ts";

async function run(code: string) {
  return runHeadless(
    createLocalRunner(ENGINES),
    { language: "edexcel", source: code, files: {}, seed: 1, breakpoints: [], trace: false },
    [],
  );
}

describe("EDX-28 variables set in the main program are global", () => {
  it("EDX-28 a procedure can read a variable set in the main program", async () => {
    const r = await run(
      "SET total TO 5\nPROCEDURE show()\nBEGIN PROCEDURE\nSEND total TO DISPLAY\nEND PROCEDURE\nshow()\n",
    );
    expect([r.stdout, r.errors]).toEqual(["5\n", []]);
  });
});

describe("EDX-100 to EDX-104 what the official papers show", () => {
  it("EDX-100 the binary search idiom (SET found TO TRUE, NOT found, DIV) runs", async () => {
    const r = await run(
      "SET found TO FALSE\nSET s TO 0\nSET e TO 9\nWHILE NOT found AND s <= e DO\nSET m TO (s + e) DIV 2\nIF m = 4 THEN\nSET found TO TRUE\nELSE\nSET e TO m - 1\nEND IF\nEND WHILE\nSEND m TO DISPLAY\n",
    );
    expect([r.stdout, r.errors]).toEqual(["4\n", []]);
  });
  it("EDX-101 a bare `end = middle - 1` is an error that says to use SET", async () => {
    const r = await run("SET middle TO 4\nend = middle - 1\n");
    expect(r.status).toBe("error");
    expect(r.errors.length).toBe(1);
  });
  it("EDX-102 booleans are accepted in any case", async () => {
    const r = await run("SET found TO False\nIF found = False THEN\nSEND 1 TO DISPLAY\nEND IF\n");
    expect(r.stdout).toBe("1\n");
  });
  it("EDX-103 record-style dot access is not part of Edexcel", async () => {
    const r = await run("SET a TO [1, 2]\nSEND a.Distance[0] TO DISPLAY\n");
    expect(r.status).toBe("error");
  });
  it("EDX-104 SET, RANDOM, REPEAT TIMES, IF and SEND run together", async () => {
    const r = await run("REPEAT 3 TIMES\nSET d TO RANDOM(5)\nIF d >= 0 THEN\nSEND 1 TO DISPLAY\nEND IF\nEND REPEAT\n");
    expect([r.stdout, r.errors]).toEqual(["1\n1\n1\n", []]);
  });
});
