// A runtime error in the student's program (E-RUN-...). The runtime throws one; the driver catches it, turns it
// into a diagnostic with the message catalogue's words (SH-15) and ends the run. Plain fields, no parameter
// properties, so Node can run this file without a TypeScript build step.
import type { Span } from "../diagnostics.ts";
import type { MessageArgs } from "../messages/index.ts";

export class RunError extends Error {
  readonly code: string;
  readonly span: Span;
  readonly args: MessageArgs;
  readonly variant: string | undefined;

  constructor(code: string, span: Span, args: MessageArgs = {}, variant?: string) {
    super(code);
    this.name = "RunError";
    this.code = code;
    this.span = span;
    this.args = args;
    this.variant = variant;
  }
}
