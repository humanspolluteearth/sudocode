import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// packages/core must run in Node and in a Web Worker (CLAUDE.md): no React, CodeMirror, UI package or DOM globals.
const srcDir = join(import.meta.dirname, "..", "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const forbiddenImport = /\bfrom\s+["'](react|react-dom|@codemirror\/[^"']*|@sudocode\/ui|[^"']*packages\/ui[^"']*)["']/;
const forbiddenGlobal = /\b(window|document|localStorage|sessionStorage|navigator)\s*\./;

describe("MISC packages/core stays free of UI and browser code", () => {
  const files = sourceFiles(srcDir);

  it("MISC finds the core source files", () => {
    expect(files.map((f) => relative(srcDir, f))).toContain("index.ts");
  });

  it("MISC no core file imports React, CodeMirror or the UI package", () => {
    const offenders = files.filter((f) => forbiddenImport.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => relative(srcDir, f))).toEqual([]);
  });

  it("MISC no core file uses DOM globals", () => {
    const offenders = files.filter((f) => forbiddenGlobal.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => relative(srcDir, f))).toEqual([]);
  });

  it.each([
    ['import { useState } from "react";', true],
    ['import { EditorView } from "@codemirror/view";', true],
    ['import { App } from "@sudocode/ui";', true],
    ['import { lex } from "./lexer.ts";', false],
  ])("MISC the import guard classifies %s as forbidden=%s", (line, forbidden) => {
    expect(forbiddenImport.test(line)).toBe(forbidden);
  });
});
