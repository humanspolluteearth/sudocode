import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The prototype's 41 pseudocode probes (reference/prototype/data/pseudocode-probes.json): 25 Edexcel, 16 Cambridge.
// harvested.test.ts checks each file; this checks none went missing.
const probesDir = join(import.meta.dirname, "probes");
const count = (lang: string, ext: string): number =>
  readdirSync(join(probesDir, lang)).filter((f) => f.endsWith(ext)).length;

describe("MISC harvested pseudocode probes", () => {
  it("MISC has all 41 probes: 25 Edexcel and 16 Cambridge", () => {
    expect([count("edexcel", ".epc"), count("cie", ".cpc")]).toEqual([25, 16]);
  });

  it("MISC has one expected file per probe", () => {
    expect([count("edexcel", ".expected.json"), count("cie", ".expected.json")]).toEqual([25, 16]);
  });
});
