// Entry file for the CHECK worker. It lives as long as the editor and re-checks the source as the student types.
import { ENGINES } from "../runner/engines.ts";
import type { WorkerScope } from "./scope.ts";
import { serveChecker } from "./serve.ts";

serveChecker(globalThis as unknown as WorkerScope, ENGINES);
