// A pane size in pixels that is clamped and remembered in this browser (a convenience; works without storage).
import { useState } from "react";

export function usePaneSize(key: string, initial: number, min: number, max: number) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const [size, setSize] = useState(() => {
    try {
      const saved = Number(globalThis.localStorage.getItem(key));
      return saved > 0 ? clamp(saved) : initial;
    } catch {
      return initial;
    }
  });
  const set = (n: number) => {
    const next = clamp(n);
    setSize(next);
    try {
      globalThis.localStorage.setItem(key, String(next));
    } catch {
      // Storage blocked: the size still changes for this visit.
    }
  };
  return [size, set] as const;
}
