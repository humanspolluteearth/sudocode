// The engines Sudocode ships: Edexcel and Cambridge pseudocode, and the Python subset (M8).
import { edexcelEngine } from "../edexcel/engine.ts";
import { cieEngine } from "../cie/engine.ts";
import { pythonEngine } from "../python/engine.ts";
import type { EngineRegistry } from "./engine.ts";

export const ENGINES: EngineRegistry = { edexcel: edexcelEngine, cie: cieEngine, python: pythonEngine };
