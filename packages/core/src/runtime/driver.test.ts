import { describe, expect, it } from "vitest";
import type { RunnerEvent } from "../protocol.ts";
import {
  at,
  call,
  deepChain,
  dec,
  fn,
  global,
  ifThen,
  local,
  loopWhile,
  num,
  op,
  print,
  program,
  ret,
  set,
  text,
  yes,
} from "../../tests/support/ir.ts";
import type { Stmt } from "../ir/ir.ts";
import { runProgram } from "./driver.ts";
import { run, type Outcome } from "../../tests/support/run-ir.ts";

describe("MISC driver: running a program", () => {
  it("MISC runs statements in order, prints one line per output, and ends with done", async () => {
    const outcome = await run(
      program([set(global("x"), num(6)), print(op("mul", global("x"), num(7))), print(text("bye"))]),
    );
    expect(outcome.stdout).toBe("42\nbye\n");
    expect(outcome.status).toBe("finished");
    expect(outcome.events.at(-1)).toEqual({ type: "done", status: "finished" });
  });

  it("MISC keeps the output printed before a runtime error, then reports the error and ends", async () => {
    const outcome = await run(program([print(text("before"), 1), print(op("divReal", num(1), num(0), 2), 2)]));
    expect(outcome.stdout).toBe("before\n");
    expect(outcome.errors).toEqual(["E-RUN-DIV-ZERO 2"]);
    expect(outcome.status).toBe("error");
    expect(outcome.events.map((e) => e.type)).toEqual(["output", "error", "done"]);
  });

  it("MISC reports a bug in the engine as E-INTERNAL-ENGINE instead of crashing", async () => {
    // A condition that is not a BOOLEAN can't come from a checked program: it is an engine bug.
    const outcome = await run(program([ifThen(num(1), [print(text("no"))])]));
    expect(outcome.errors).toEqual(["E-INTERNAL-ENGINE 1"]);
    expect(outcome.status).toBe("error");
  });

  it("MISC a run still ends when an error's message can't be built (a wording bug is reported as internal)", async () => {
    // E-RUN-NO-VALUE needs {name}; leaving it out is a bug in the engine, but the UI must never wait forever.
    const broken = program([print({ kind: "fail", code: "E-RUN-NO-VALUE", args: {}, span: at(3) }, 3)]);
    const outcome = await run(broken);
    expect(outcome.errors).toEqual(["E-INTERNAL-ENGINE 1"]);
    expect(outcome.status).toBe("error");
  });

  it("MISC a subprogram's runtime error ends the run, pointing at the student's line", async () => {
    const half = fn("Half", ["n"], [ret(op("divReal", local("n", 3), num(0, 3), 3), 3)]);
    const outcome = await run(program([print(call("Half", [num(4)], 7), 7)], [half]));
    expect(outcome.errors).toEqual(["E-RUN-DIV-ZERO 3"]);
  });

  it("MISC a FUNCTION that reaches its end without RETURN is a runtime error (EDX-61)", async () => {
    const noReturn = fn("Nothing", [], [print(text("in"))]);
    const outcome = await run(program([print(call("Nothing", [], 5), 5)], [noReturn]));
    expect(outcome.stdout).toBe("in\n");
    expect(outcome.errors).toEqual(["E-RUN-NO-RETURN 1"]);
  });

  it("MISC reports a runtime info note once, however often it happens (EDX-27)", async () => {
    const grow = (index: number, line: number): Stmt => ({
      kind: "assign",
      target: {
        kind: "element",
        array: global("a"),
        index: num(index),
        base: 0,
        growOnWrite: true,
        text: "a",
        span: at(line),
      },
      value: num(9),
      span: at(line),
    });
    const outcome = await run(
      program([set(global("a"), { kind: "arrayLiteral", elements: [num(1)], span: at(1) }), grow(3, 2), grow(5, 3)]),
    );
    expect(outcome.errors).toEqual(["I-EDX-ARRAY-GROWS 2"]);
    expect(outcome.status).toBe("finished");
  });
});

describe("SH-13 recursion depth: a trampolined, explicit call stack", () => {
  it("SH-13 a chain of 1,000 nested calls runs", async () => {
    const outcome = await run(deepChain(999)); // Down(999) ... Down(0): 1,000 calls
    expect(outcome.stdout).toBe("999\n");
    expect(outcome.status).toBe("finished");
  });

  it("SH-13 the 1,001st nested call is a runtime error naming the subprogram", async () => {
    const outcome = await run(deepChain(1000));
    expect(outcome.errors).toEqual(["E-RUN-RECURSION-LIMIT 4"]);
    const error = outcome.events.find((e) => e.type === "error");
    expect(error?.type === "error" ? error.diagnostic.message : "").toBe(
      "Down called itself more than 1,000 times without stopping",
    );
  });

  it("MISC interpreted calls don't nest JavaScript frames: 200,000 nested calls run with the limit raised", async () => {
    // Directly nested generators would overflow the JavaScript stack long before this (docs/AUDIT.md).
    const outcome = await run(deepChain(200_000), { maxCallDepth: 300_000 });
    expect(outcome.stdout).toBe("200000\n");
  });

  it("MISC a refused call can be seen by the caller's frame, which then fails too", async () => {
    const outcome = await run(deepChain(5), { maxCallDepth: 3 });
    expect(outcome.errors).toEqual(["E-RUN-RECURSION-LIMIT 4"]);
    expect(outcome.status).toBe("error");
  });
});

describe("SH-14 the step limit", () => {
  const forever = program([
    set(global("n"), num(0), 1),
    loopWhile(yes(2), [set(global("n"), op("add", global("n"), num(1)), 3)], 2),
  ]);

  it("SH-14 pauses a possible infinite loop after the step limit, and Continue runs another full budget", async () => {
    let pauses = 0;
    const outcome = await run(forever, { stepLimit: 1000, sliceSteps: 300 }, (event, send) => {
      if (event.type !== "paused") return;
      pauses++;
      send(pauses < 2 ? { type: "continue" } : { type: "stop" });
    });
    const paused = outcome.events.filter((e) => e.type === "paused");
    expect(paused.map((e) => e.reason)).toEqual(["stepLimit", "stepLimit"]);
    expect(outcome.status).toBe("stopped");
    // Paused before a statement of the loop, with the main program's variables.
    const first = paused[0];
    expect(first?.type === "paused" ? first.stack.map((f) => f.name) : []).toEqual(["(main program)"]);
    expect(first?.type === "paused" ? first.stack[0]?.variables.map((v) => [v.name, v.type]) : []).toEqual([
      ["n", "INTEGER"],
    ]);
  });

  it("SH-14 Continue after the step limit gives the program another full budget of steps", async () => {
    const counts: number[] = [];
    await run(forever, { stepLimit: 1000, sliceSteps: 300 }, (event, send) => {
      if (event.type !== "paused") return;
      const n = event.stack[0]?.variables.find((v) => v.name === "n");
      counts.push(Number(n?.value));
      send(counts.length < 2 ? { type: "continue" } : { type: "stop" });
    });
    const [first = 0, second = 0] = counts;
    // The loop does the same work every pass, so the same budget adds the same amount to n (give or take the
    // two statements before the loop, which only the first budget pays for).
    expect(first).toBeGreaterThan(100);
    expect(Math.abs(second - first - first)).toBeLessThanOrEqual(1);
  });

  it("MISC an empty loop still counts steps, so it reaches the limit too", async () => {
    const empty = program([loopWhile(yes(1), [], 1)]);
    const outcome = await run(empty, { stepLimit: 500 }, (event, send) => {
      if (event.type === "paused") send({ type: "stop" });
    });
    expect(outcome.events.some((e) => e.type === "paused" && e.reason === "stepLimit")).toBe(true);
    expect(outcome.status).toBe("stopped");
  });
});

describe("MISC driver commands", () => {
  it("MISC Stop ends a running program at once", async () => {
    const forever = program([loopWhile(yes(1), [], 1)]);
    let sent = false;
    const outcome = await new Promise<Outcome>((resolve) => {
      const events: RunnerEvent[] = [];
      const engine = runProgram({
        language: "edexcel",
        program: forever,
        sliceSteps: 100,
        emit: (e) => {
          events.push(e);
          if (e.type === "done") resolve({ events, stdout: "", status: e.status, errors: [] });
        },
        schedule: (resume) =>
          setTimeout(() => {
            if (!sent) {
              sent = true;
              engine.command({ type: "stop" });
            }
            resume();
          }, 0),
      });
    });
    expect(outcome.status).toBe("stopped");
    expect(outcome.events).toEqual([{ type: "done", status: "stopped" }]);
  });

  it("MISC Pause stops before the next statement and shows where; Continue finishes the run", async () => {
    const counting = program([
      set(global("x"), dec(1.5), 1),
      loopWhile(op("lt", global("x"), num(1000), 2), [set(global("x"), op("add", global("x"), num(1), 3), 3)], 2),
      print(global("x"), 4),
    ]);
    let paused = false;
    const events: RunnerEvent[] = [];
    await new Promise<void>((resolve) => {
      const engine = runProgram({
        language: "edexcel",
        program: counting,
        sliceSteps: 10,
        emit: (e) => {
          events.push(e);
          if (e.type === "paused") {
            setTimeout(() => {
              engine.command({ type: "continue" });
            }, 0);
          }
          if (e.type === "done") resolve();
        },
        schedule: (resume) =>
          setTimeout(() => {
            if (!paused) {
              paused = true;
              engine.command({ type: "pause" });
            }
            resume();
          }, 0),
      });
    });
    const pause = events.find((e) => e.type === "paused");
    expect(pause?.type === "paused" ? [pause.reason, pause.line] : []).toEqual(["pause", 1]);
    expect(events.filter((e) => e.type === "output")).toEqual([{ type: "output", text: "1000.5\n" }]);
    expect(events.at(-1)).toEqual({ type: "done", status: "finished" });
  });

  it("MISC Pause sent while a loop runs stops inside the loop, with the variables as they are there", async () => {
    // x counts up and is printed each pass, so the output so far tells us how far the run got.
    const counting = program([
      set(global("x"), num(0), 1),
      loopWhile(
        op("lt", global("x"), num(1000), 2),
        [set(global("x"), op("add", global("x"), num(1), 3), 3), print(global("x"), 4)],
        2,
      ),
    ]);
    let asked = false;
    const outcome = await run(counting, { sliceSteps: 10 }, (event, send) => {
      if (event.type === "output" && !asked) {
        asked = true;
        send({ type: "pause" });
      }
      if (event.type === "paused") send({ type: "continue" });
    });
    const index = outcome.events.findIndex((e) => e.type === "paused");
    const pause = outcome.events[index];
    if (pause?.type !== "paused") throw new Error("No pause");
    expect(pause.reason).toBe("pause");
    expect([2, 3, 4]).toContain(pause.line);
    const printed = outcome.events
      .slice(0, index)
      .flatMap((e) => (e.type === "output" ? e.text.split("\n").filter((l) => l !== "") : []));
    const x = Number(pause.stack[0]?.variables.find((v) => v.name === "x")?.value);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(1000);
    // Paused before line 4, x is one ahead of the last print; anywhere else, x has just been printed.
    expect(x - Number(printed.at(-1))).toBe(pause.line === 4 ? 1 : 0);
    expect(outcome.stdout.split("\n").filter((l) => l !== "")).toHaveLength(1000);
    expect(outcome.status).toBe("finished");
  });
});

describe("SH-17 driver: the trace table", () => {
  const prog = program([set(global("x"), num(6), 1), print(global("x"), 2)]);

  it("SH-17 records nothing unless the trace is turned on", async () => {
    const outcome = await run(prog);
    expect(outcome.events.filter((e) => e.type === "traceRows")).toEqual([]);
  });

  it("SH-17 sends each assignment and output with its line, in order, before done", async () => {
    const outcome = await run(prog, { trace: true });
    const rows = outcome.events.flatMap((e) => (e.type === "traceRows" ? e.rows : []));
    expect(rows).toEqual([
      { kind: "assign", line: 1, variable: "x", value: "6" },
      { kind: "output", line: 2, text: "6" },
    ]);
    const lastRows = outcome.events.findLastIndex((e) => e.type === "traceRows");
    expect(lastRows).toBeGreaterThanOrEqual(0);
    expect(lastRows).toBeLessThan(outcome.events.findIndex((e) => e.type === "done"));
  });
});

describe("MISC driver: breakpoints and stepping over calls", () => {
  // 2: RETURN n * 2 (inside Double) · 5: SET x TO Double(3) · 6: SEND x TO DISPLAY
  const double = fn("Double", ["n"], [ret(op("mul", local("n", 2), num(2, 2), 2), 2)]);
  const prog = program([set(global("x"), call("Double", [num(3, 5)], 5), 5), print(global("x"), 6)], [double]);

  /** Runs to a breakpoint on line 5, then sends `commands` one per pause; returns "reason line frame" per pause. */
  async function pauses(commands: ("stepOver" | "stepInto" | "stepOut")[]): Promise<string[]> {
    const seen: string[] = [];
    const queue = [...commands];
    const outcome = await run(prog, { breakpoints: [5] }, (event, send) => {
      if (event.type !== "paused") return;
      seen.push(`${event.reason} ${String(event.line)} ${event.stack[0]?.name ?? "?"}`);
      send({ type: queue.shift() ?? "continue" });
    });
    expect(outcome.stdout).toBe("6\n");
    return seen;
  }

  it("MISC Step over runs a whole call and stops at the next line", async () => {
    expect(await pauses(["stepOver"])).toEqual(["breakpoint 5 (main program)", "step 6 (main program)"]);
  });

  it("MISC Step into stops at the first line inside the call, and Step out returns to the caller", async () => {
    expect(await pauses(["stepInto", "stepOut"])).toEqual([
      "breakpoint 5 (main program)",
      "step 2 Double",
      "step 6 (main program)",
    ]);
  });
});
