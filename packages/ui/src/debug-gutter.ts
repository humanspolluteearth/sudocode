// CodeMirror pieces for the debugger: a breakpoint gutter (click a line number's left edge to set or clear a
// breakpoint) and the highlight on the line the program is paused before.
//
// Breakpoints live in the editor state as a RangeSet, so CodeMirror moves them with the text as the student
// edits (a breakpoint on line 5 stays on the same statement when a line is added above it).
import { RangeSet, StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, GutterMarker, gutter, keymap, type DecorationSet } from "@codemirror/view";

class BreakpointMarker extends GutterMarker {
  override toDOM(): Node {
    const dot = document.createElement("span");
    dot.className = "sc-bp-dot";
    dot.setAttribute("aria-hidden", "true");
    return dot;
  }
}
const breakpointMarker = new BreakpointMarker();

/** Turns the breakpoint at a document position on or off. */
export const toggleBreakpoint = StateEffect.define<number>();
/** The 1-based line the program is paused before, or null while it runs or after it ends. */
export const setPausedLine = StateEffect.define<number | null>();

function hasMarkerAt(set: RangeSet<GutterMarker>, pos: number): boolean {
  const iter = set.iter(pos);
  return iter.value !== null && iter.from === pos;
}

export const breakpointField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(set, tr) {
    let next = set.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(toggleBreakpoint)) {
        next = hasMarkerAt(next, e.value)
          ? next.update({ filter: (from) => from !== e.value })
          : next.update({ add: [breakpointMarker.range(e.value)] });
      }
    }
    return next;
  },
});

/** The 1-based lines that have a breakpoint, in order and without repeats. */
export function breakpointLines(state: EditorState): number[] {
  const lines = new Set<number>();
  const iter = state.field(breakpointField).iter();
  while (iter.value !== null) {
    lines.add(state.doc.lineAt(iter.from).number);
    iter.next();
  }
  return [...lines].sort((a, b) => a - b);
}

const pausedLineDeco = Decoration.line({ class: "sc-paused-line" });

const pausedField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    let next = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setPausedLine)) continue;
      const line = e.value;
      next =
        line === null || line < 1 || line > tr.state.doc.lines
          ? Decoration.none
          : Decoration.set([pausedLineDeco.range(tr.state.doc.line(line).from)]);
    }
    return next;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** F9 sets or clears a breakpoint on the cursor's line, so the gutter also works from the keyboard. */
function toggleAtCursor(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  view.dispatch({ effects: toggleBreakpoint.of(line.from) });
  return true;
}

export function debugGutter(): Extension {
  return [
    breakpointField,
    pausedField,
    keymap.of([{ key: "F9", run: toggleAtCursor }]),
    gutter({
      class: "sc-bp-gutter",
      markers: (v) => v.state.field(breakpointField),
      initialSpacer: () => breakpointMarker,
      domEventHandlers: {
        mousedown(view, line) {
          view.dispatch({ effects: toggleBreakpoint.of(line.from) });
          return true;
        },
      },
    }),
  ];
}
