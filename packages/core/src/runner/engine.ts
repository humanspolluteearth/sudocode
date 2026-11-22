// An Engine runs one language. The Runner talks to engines through this interface only, so the UI stays the
// same whichever engine is behind it (DECISIONS: "Keep Runner interface engine-neutral").
// M1 has no engines; milestone M2 registers the first one (Edexcel).
import type { Diagnostic } from "../diagnostics.ts";
import type { Language } from "../language.ts";
import type { RunnerCommand, RunnerEvent, RunRequest } from "../protocol.ts";

export interface EngineRun {
  /** Every command after `run` (input, pause, steps, stop, breakpoints) for this run. */
  command(command: Exclude<RunnerCommand, { type: "run" }>): void;
}

export interface Engine {
  /** Checks the source without running it (the check worker calls this as the student types). */
  check(source: string): Diagnostic[];
  /** Starts a run. The engine reports everything through `emit` and must end with one `done` event. */
  start(request: RunRequest, emit: (event: RunnerEvent) => void): EngineRun;
}

export type EngineRegistry = Partial<Record<Language, Engine>>;
