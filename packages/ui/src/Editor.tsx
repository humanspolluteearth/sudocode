// The code editor: CodeMirror 6 with line numbers, Edexcel highlighting and lint underlines.
// CodeMirror owns the text while the student types; React only passes in changes from outside (a new example).
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { setDiagnostics } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import type { Diagnostic } from "@sudocode/core";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { toCodeMirrorDiagnostics } from "./diagnostics-bridge.ts";
import { edexcelHighlight, edexcelLanguage } from "./edexcel-language.ts";

export interface EditorHandle {
  /** Moves the cursor to a 1-based line and column and focuses the editor (used by the Problems list). */
  goTo: (line: number, column: number) => void;
}

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  diagnostics: readonly Diagnostic[];
  ariaLabel?: string;
}

const theme = EditorView.theme({
  "&": { height: "100%", color: "var(--fg)", backgroundColor: "var(--bg)" },
  ".cm-scroller": { fontFamily: "var(--code-font)", fontSize: "calc(14px * var(--zoom, 1))", lineHeight: "1.5" },
  ".cm-gutters": { backgroundColor: "var(--gutter)", color: "var(--lnum)", borderRight: "1px solid var(--line2)" },
  ".cm-activeLine": { backgroundColor: "var(--cur)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--cur)" },
  ".cm-cursor": { borderLeftColor: "var(--fg)" },
  "&.cm-focused": { outline: "2px solid var(--link)", outlineOffset: "-2px" },
  ".cm-tooltip": { backgroundColor: "var(--bg)", color: "var(--fg)", border: "1px solid var(--field)" },
  ".cm-diagnostic": { padding: "3px 6px" },
});

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { value, onChange, diagnostics, ariaLabel = "Program editor" },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // The latest callback, so the editor is created once and never rebuilt when the parent re-renders.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (host.current === null) return;
    const created = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          indentOnInput(),
          bracketMatching(),
          edexcelLanguage,
          edexcelHighlight,
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.contentAttributes.of({ "aria-label": ariaLabel, spellcheck: "false", autocapitalize: "off" }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
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

  useImperativeHandle(ref, () => ({
    goTo(line, column) {
      const v = view.current;
      if (v === null) return;
      const info = v.state.doc.line(Math.min(Math.max(line, 1), v.state.doc.lines));
      const pos = Math.min(info.from + Math.max(column - 1, 0), info.to);
      v.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      v.focus();
    },
  }));

  return <div className="sc-editor" ref={host} />;
});
