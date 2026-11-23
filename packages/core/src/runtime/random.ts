// A seedable random number generator (SH-12).
//
// Normal runs start from a fresh seed; tests and "replay" pass a fixed one, so the same seed always gives the same
// numbers. This is mulberry32: a few lines, fast, and good enough for a classroom's dice and shuffles. (Matching
// CPython's own generator exactly is a Python-engine matter, QUESTIONS.md 2.)
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // from 0 up to, but not including, 1
  };
}
