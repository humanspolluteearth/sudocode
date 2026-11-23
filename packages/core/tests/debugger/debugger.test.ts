import { describe, expect, it } from "vitest";
import { createLocalRunner } from "../../src/runner/local-runner.ts";
import { ENGINES } from "../../src/runner/engines.ts";
import { readPending, verdict } from "../support/golden.ts";
import { discoverSessions, playSession } from "../support/session.ts";

// Scripted debugger sessions (M4): each plays a program with breakpoints and debugger commands through the Runner
// the IDE uses, checking every pause. Test names start with the session's file name, which starts with its spec ID.
const sessions = discoverSessions();
const pending = readPending();

describe("debugger sessions", () => {
  it("MISC finds the debugger sessions", () => {
    expect(sessions.length).toBeGreaterThanOrEqual(10);
  });

  // SH-14's session runs 10 million steps, so sessions get a long timeout.
  it.each(sessions.map((s) => [`${s.name} (${s.id})`, s] as const))(
    "%s",
    async (_title, session) => {
      const problems = await playSession(createLocalRunner(ENGINES), session.source, session.session);
      const outcome = verdict(problems, pending.has(session.id));
      if (!outcome.ok) expect.fail(`${session.id}\n${outcome.reason}`);
    },
    60_000,
  );
});
