import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from "./preferences.ts";

afterEach(() => {
  globalThis.localStorage.clear();
});

describe("MISC preferences language", () => {
  it("MISC defaults to Edexcel", () => {
    expect(loadPreferences().language).toBe("edexcel");
  });
  it("MISC remembers Cambridge", () => {
    savePreferences({ ...DEFAULT_PREFERENCES, language: "cie" });
    expect(loadPreferences().language).toBe("cie");
  });
  it("MISC an unknown stored language falls back to Edexcel", () => {
    globalThis.localStorage.setItem("sudocode.preferences", JSON.stringify({ language: "python" }));
    expect(loadPreferences().language).toBe("edexcel");
  });
});
