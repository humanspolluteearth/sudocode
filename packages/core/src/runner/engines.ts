// The engines Sudocode ships. Cambridge pseudocode arrives in M7 and Python in M8.
import { edexcelEngine } from "../edexcel/engine.ts";
import { cieEngine } from "../cie/engine.ts";
import type { EngineRegistry } from "./engine.ts";

export const ENGINES: EngineRegistry = { edexcel: edexcelEngine, cie: cieEngine };
