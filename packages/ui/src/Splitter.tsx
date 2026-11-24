// A drag handle between two panes. Pointer: drag. Keyboard: focus it, then arrow keys (Shift = bigger steps).
// It reports the pane's new size in pixels; the parent clamps and stores it.
import { useRef, type KeyboardEvent, type PointerEvent } from "react";

export interface SplitterProps {
  /** "vertical" is a vertical bar that changes a width; "horizontal" is a horizontal bar that changes a height. */
  orientation: "vertical" | "horizontal";
  label: string;
  /** Current size (px) of the pane being resized. */
  size: number;
  onResize: (size: number) => void;
  /** True when dragging towards the start (left/up) makes the pane bigger (the pane is after the bar). */
  growsBackwards?: boolean;
}

export function Splitter({ orientation, label, size, onResize, growsBackwards = true }: SplitterProps) {
  const drag = useRef<{ at: number; size: number } | null>(null);
  const axis = (e: { clientX: number; clientY: number }) => (orientation === "vertical" ? e.clientX : e.clientY);
  const sign = growsBackwards ? -1 : 1;
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 10;
    const back = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
    const fwd = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
    if (e.key !== back && e.key !== fwd) return;
    e.preventDefault();
    onResize(size + (e.key === fwd ? 1 : -1) * sign * step);
  };
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation === "vertical" ? "vertical" : "horizontal"}
      aria-valuenow={Math.round(size)}
      className={`sc-splitter ${orientation}`}
      onKeyDown={onKey}
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { at: axis(e), size };
      }}
      onPointerMove={(e) => {
        if (drag.current !== null) onResize(drag.current.size + sign * (axis(e) - drag.current.at));
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}
