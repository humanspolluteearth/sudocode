// The converter's public face: pseudocode -> Python (M10). The implementation arrives in the next PR; until then
// the round-trip tests (tests/converter/) are pending and fail on this stub.
import type { Language } from "../language.ts";

/** A pseudocode language the converter can read (Edexcel and Cambridge 9618; Python is the target). */
export type ConvertFrom = Extract<Language, "edexcel" | "cie">;

/** The parts of a program the converter refuses, because Python can't do them faithfully. */
export type RefusedFeature = "files" | "types" | "classes" | "errors" | "byref" | "dates" | "devices" | "problems";

export type ConvertResult =
  | { ok: true; code: string }
  | {
      ok: false;
      code: "E-CONV-UNSUPPORTED";
      feature: RefusedFeature;
      line: number;
      column: number;
      /** Plain words for a student: what can't be converted. */
      message: string;
      hint: string;
    };

export function convertToPython(source: string, from: ConvertFrom): ConvertResult {
  throw new Error(`The converter is not written yet (${from}, ${String(source.length)} characters)`);
}
