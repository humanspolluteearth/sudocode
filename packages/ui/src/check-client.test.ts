import type { Diagnostic } from "@sudocode/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckClient } from "./check-client.ts";
import { FakeWorker } from "./fake-worker.ts";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("MISC the debounced check worker client", () => {
  it("MISC sends one check 300 ms after the last keystroke", () => {
    const w = new FakeWorker();
    const c = createCheckClient(w, "edexcel", () => undefined);
    c.request("a");
    vi.advanceTimersByTime(200);
    c.request("ab");
    vi.advanceTimersByTime(299);
    expect(w.posted).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(w.posted).toEqual([{ type: "check", id: 1, language: "edexcel", source: "ab" }]);
  });
  it("MISC ignores an answer to out-of-date source", () => {
    const w = new FakeWorker();
    const seen: (readonly Diagnostic[])[] = [];
    const c = createCheckClient(w, "edexcel", (d) => seen.push(d));
    c.request("a");
    vi.advanceTimersByTime(300);
    c.request("b");
    vi.advanceTimersByTime(300);
    w.reply({ type: "checked", id: 1, diagnostics: [] });
    expect(seen).toEqual([]);
    w.reply({ type: "checked", id: 2, diagnostics: [] });
    expect(seen).toEqual([[]]);
  });
  it("MISC dispose cancels a waiting check and terminates the worker", () => {
    const w = new FakeWorker();
    const c = createCheckClient(w, "edexcel", () => undefined);
    c.request("a");
    c.dispose();
    vi.advanceTimersByTime(500);
    expect(w.posted).toEqual([]);
    expect(w.terminated).toBe(true);
  });
});
