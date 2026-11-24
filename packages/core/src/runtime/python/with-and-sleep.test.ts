import { describe, expect, it } from "vitest";
import { analyse } from "../../python/engine.ts";
import type { RunnerEvent } from "../../protocol.ts";
import { runProgram } from "../driver.ts";

// Runs a Python program with an injected `sleep`, so no test waits on the real clock (dependency injection).
interface Outcome {
  stdout: string;
  sleeps: number[];
  errors: string[];
  files: Record<string, string>;
}

function run(source: string): Promise<Outcome> {
  const { program } = analyse(source);
  if (program === null) throw new Error("did not compile");
  return new Promise((resolve) => {
    const outcome: Outcome = { stdout: "", sleeps: [], errors: [], files: {} };
    runProgram({
      language: "python",
      program,
      seed: 1,
      sleep: (ms, resume) => {
        outcome.sleeps.push(ms);
        resume();
      },
      emit: (e: RunnerEvent) => {
        if (e.type === "output") outcome.stdout += e.text;
        if (e.type === "error") outcome.errors.push(e.diagnostic.code);
        if (e.type === "fileWrite") outcome.files[e.name] = e.contents;
        if (e.type === "done") resolve(outcome);
      },
    });
  });
}

describe("PY-21 with closes the file", () => {
  it("PY-21 writing after the with block raises ValueError (the file was closed)", async () => {
    const r = await run(
      'with open("w.txt", "w") as f:\n    f.write("a")\ntry:\n    f.write("b")\nexcept ValueError as e:\n    print(e)\n',
    );
    expect(r.errors).toEqual([]);
    expect(r.stdout).toBe("I/O operation on closed file.\n");
    expect(r.files).toEqual({ "w.txt": "a" });
  });
});

describe("PY-43 time.sleep with an injected clock", () => {
  it("PY-43 sleep(2.5) asks the host to wait 2500 ms, then the program goes on", async () => {
    const r = await run('import time\ntime.sleep(2.5)\nprint("after")\n');
    expect(r.sleeps).toEqual([2500]);
    expect(r.stdout).toBe("after\n");
  });
  it("PY-43 a negative sleep is a ValueError and never reaches the host", async () => {
    const r = await run("import time\ntry:\n    time.sleep(-1)\nexcept ValueError as e:\n    print(e)\n");
    expect(r.sleeps).toEqual([]);
    expect(r.stdout).toBe("sleep length must be non-negative\n");
  });
});
