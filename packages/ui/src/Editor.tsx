// The code editor: CodeMirror 6 with line numbers, Edexcel highlighting and lint underlines.
// CodeMirror owns the text while the student types; React only passes in changes from outside (a new example).
import { defaultKeymap, history, historyKeymap, indentMore } from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { setDiagnostics } from "@codemirror/lint";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import type { Diagnostic } from "@sudocode/core";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { breakpointField, breakpointLines, debugGutter, setPausedLine, toggleBreakpoint } from "./debug-gutter.ts";
import { toCodeMirrorDiagnostics } from "./diagnostics-bridge.ts";
import { cieLanguage } from "./cie-language.ts";
import { pythonLanguage } from "./python-language.ts";
import { edexcelHighlight, edexcelLanguage } from "./edexcel-language.ts";

export interface EditorHandle {
  /** Moves the cursor to a 1-based line and column and focuses the editor (used by the Problems list). */
  goTo: (line: number, column: number) => void;
  /** Removes every breakpoint (the toolbar's "Clear breakpoints"). */
  clearBreakpoints: () => void;
  /** Types text at the cursor (replacing any selection) and focuses the editor (Quick reference "Insert"). */
  insertAtCursor: (text: string) => void;
}

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  diagnostics: readonly Diagnostic[];
  ariaLabel?: string;
  /** Called with the breakpoint lines whenever the student sets or clears one (or edits move them). */
  onBreakpointsChange?: (lines: number[]) => void;
  /** Called with the cursor's line and column (both 1-based) whenever it moves. */
  onCursorChange?: (cursor: { line: number; column: number }) => void;
  /** The line the debugger is paused before, highlighted; null when not paused. */
  pausedLine?: number | null;
  /** Which pseudocode to colour; Edexcel by default. */
  language?: "edexcel" | "cie" | "python";
  /** False when the Breakpoints tool is switched off: the gutter is hidden and ignores clicks and F9. */
  breakpointsEnabled?: boolean;
}

// A Compartment is CodeMirror's way to swap one extension later without rebuilding the editor.
const languageSlot = new Compartment();
const languageExtension = (language: "edexcel" | "cie" | "python") =>
  language === "cie" ? cieLanguage : language === "python" ? pythonLanguage : edexcelLanguage;

const theme = EditorView.theme({
  "&": { height: "100%", color: "var(--fg)", backgroundColor: "var(--bg)" },
  ".cm-scroller": {
    fontFamily: "var(--code-font)",
    fontSize: "calc(13px * var(--zoom, 1))",
    lineHeight: "calc(19px * var(--zoom, 1))",
  },
  ".cm-content": { fontVariantLigatures: "none" },
  // Selected text is tinted with the link colour in both themes (CodeMirror's default is a pale grey/white).
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
    background: "color-mix(in srgb, var(--link) 35%, transparent)",
  },
  ".cm-line": { padding: "0 12px" },
  ".cm-lineNumbers": { flex: "1 1 auto" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 5px", fontSize: "calc(11px * var(--zoom, 1))" },
  ".cm-gutters": {
    width: "62px",
    boxSizing: "border-box",
    backgroundColor: "var(--gutter)",
    color: "var(--lnum)",
    borderRight: "1px solid var(--line2)",
  },
  ".cm-activeLine": { backgroundColor: "var(--cur)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--cur)" },
  ".cm-cursor": { borderLeftColor: "var(--fg)" },
  // No ring on the editor: the caret shows where focus is, as in the design.
  "&.cm-focused": { outline: "none" },
  ".cm-tooltip": { backgroundColor: "var(--bg)", color: "var(--fg)", border: "1px solid var(--field)" },
  ".cm-diagnostic": { padding: "3px 6px" },
  ".sc-paused-line": { backgroundColor: "var(--paused)", outline: "1px solid var(--paused-edge)" },
  ".sc-bp-gutter": { width: "20px", cursor: "pointer" },
  ".sc-bp-gutter .cm-gutterElement": { display: "flex", alignItems: "center", justifyContent: "center" },
  ".sc-bp-dot": {
    display: "inline-block",
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    backgroundColor: "var(--red)",
  },
});

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  {
    value,
    onChange,
    diagnostics,
    ariaLabel = "Program editor",
    onBreakpointsChange,
    breakpointsEnabled = true,
    onCursorChange,
    pausedLine = null,
    language = "edexcel",
  },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // The latest callback, so the editor is created once and never rebuilt when the parent re-renders.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCursorRef = useRef(onCursorChange);
  onCursorRef.current = onCursorChange;
  // Keyboard escape hatch (the design's): Escape arms it, and the next Tab (or Shift+Tab at any time) moves focus out
  // of the editor instead of indenting. Any other key disarms it.
  const escArmed = useRef(false);
  const onBreakpointsRef = useRef(onBreakpointsChange);
  onBreakpointsRef.current = onBreakpointsChange;

  useEffect(() => {
    if (host.current === null) return;
    const created = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          debugGutter(),
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          indentOnInput(),
          bracketMatching(),
          languageSlot.of(languageExtension(language)),
          edexcelHighlight,
          keymap.of([
            {
              key: "Escape",
              run: () => {
                escArmed.current = true;
                return true;
              },
            },
            {
              key: "Tab",
              run: (v) => {
                if (escArmed.current) {
                  escArmed.current = false;
                  return false;
                }
                return indentMore(v);
              },
              // Shift+Tab always leaves, as in the design.
              shift: () => false,
            },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.domEventHandlers({
            keydown: (e) => {
              if (e.key !== "Escape" && e.key !== "Tab") escArmed.current = false;
            },
            blur: () => {
              escArmed.current = false;
            },
          }),
          EditorView.contentAttributes.of({
            "aria-label": ariaLabel,
            "aria-describedby": "sc-editor-hint",
            spellcheck: "false",
            autocapitalize: "off",
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
            if (update.selectionSet || update.docChanged) {
              const head = update.state.selection.main.head;
              const at = update.state.doc.lineAt(head);
              onCursorRef.current?.({ line: at.number, column: head - at.from + 1 });
            }
            const before = update.startState.field(breakpointField);
            const after = update.state.field(breakpointField);
            if (before !== after) {
              const lines = breakpointLines(update.state);
              if (lines.join() !== breakpointLines(update.startState).join()) onBreakpointsRef.current?.(lines);
            }
          }),
          theme,
        ],
      }),
    });
    view.current = created;
    return () => {
      created.destroy();
      view.current = null;
    };
    // The editor is created once; `value` and `diagnostics` are synced by the effects below.
  }, []);

  // A value that differs from the document came from outside (loading an example): replace the text.
  useEffect(() => {
    const v = view.current;
    if (v === null || v.state.doc.toString() === value) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    const v = view.current;
    if (v === null) return;
    v.dispatch(setDiagnostics(v.state, toCodeMirrorDiagnostics(v.state.doc.toString(), diagnostics)));
  }, [diagnostics, value]);

  useEffect(() => {
    view.current?.dispatch({ effects: languageSlot.reconfigure(languageExtension(language)) });
  }, [language]);

  useEffect(() => {
    const v = view.current;
    if (v === null) return;
    v.dispatch({ effects: setPausedLine.of(pausedLine) });
    if (pausedLine !== null && pausedLine >= 1 && pausedLine <= v.state.doc.lines) {
      v.dispatch({ effects: EditorView.scrollIntoView(v.state.doc.line(pausedLine).from, { y: "center" }) });
    }
  }, [pausedLine]);

  useImperativeHandle(ref, () => ({
    clearBreakpoints() {
      const v = view.current;
      if (v === null) return;
      // Toggling a line that has a breakpoint removes it; the update listener reports the new (empty) list.
      // toggleBreakpoint takes the document position of the line start, not the line number.
      const effects = breakpointLines(v.state).map((n) => toggleBreakpoint.of(v.state.doc.line(n).from));
      v.dispatch({ effects });
    },
    insertAtCursor(text) {
      const v = view.current;
      if (v === null) return;
      const { from, to } = v.state.selection.main;
      v.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
        scrollIntoView: true,
        userEvent: "input.paste",
      });
      v.focus();
    },
    goTo(line, column) {
      const v = view.current;
      if (v === null) return;
      const info = v.state.doc.line(Math.min(Math.max(line, 1), v.state.doc.lines));
      const pos = Math.min(info.from + Math.max(column - 1, 0), info.to);
      v.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      v.focus();
    },
  }));

  return (
    <div className={`sc-editor${breakpointsEnabled ? "" : " sc-bp-off"}`}>
      <div ref={host} className="sc-editor-host" />
      <p id="sc-editor-hint" className="sc-sr-only">
        Press Escape, then Tab, to leave the editor. Tab on its own indents.
      </p>
    </div>
  );
});
