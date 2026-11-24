import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// @sudocode/core's entry points: the public one for the UI, the engine side, and the two worker files.
const coreDir = join(import.meta.dirname, "..", "..");
const pkg = JSON.parse(readFileSync(join(coreDir, "package.json"), "utf8")) as { exports: Record<string, string> };

describe("MISC @sudocode/core entry points", () => {
  it("MISC exports exactly the public, converter, engine and worker entries", () => {
    expect(Object.keys(pkg.exports).sort()).toEqual([".", "./check-worker", "./converter", "./engine", "./run-worker"]);
  });

  it.each(Object.entries(pkg.exports))("MISC %s points at a file that exists", (_entry, path) => {
    expect(existsSync(join(coreDir, path))).toBe(true);
  });

  it("MISC the public entry doesn't hand the UI engine-side code", () => {
    const index = readFileSync(join(coreDir, "src", "index.ts"), "utf8");
    expect(index).not.toMatch(/createLocalRunner|ENGINES|serveRunner|serveChecker/);
  });
});
