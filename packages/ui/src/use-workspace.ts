// The open files and what can be done with them: new, close, switch, save, open and convert. App.tsx owns the
// run and the editor; this hook owns the tabs, so each stays under a readable size.
import { useRef, useState } from "react";
import { downloadText, parseFileName, pickTextFiles, typeOf, type SaveType } from "./file-io.ts";
import type { Note } from "./NoteBanner.tsx";
import type { PseudocodeLanguage } from "./preferences.ts";
import {
  activeTab,
  closeTab,
  editActive,
  initialWorkspace,
  isDirty,
  markSaved,
  openTab,
  setActiveLanguage,
  switchTab,
  type Workspace,
} from "./workspace.ts";

const NAMES = { edexcel: "Edexcel pseudocode", cie: "Cambridge 9618 pseudocode", python: "Python" } as const;

export interface WorkspaceHook {
  ws: Workspace;
  current: ReturnType<typeof activeTab>;
  setSource: (source: string) => void;
  setLanguage: (language: PseudocodeLanguage) => void;
  newFile: () => void;
  close: (id: number) => void;
  switchTo: (id: number) => void;
  /** Save: downloads straight away for a named file, otherwise asks for a name. */
  save: () => void;
  saveAs: () => void;
  saveAll: () => void;
  openFiles: () => void;
  convertToPython: () => void;
  /** Set while the Save dialog is on screen. */
  dialog: { name: string; type: SaveType } | null;
  finishSave: (name: string, type: SaveType) => void;
  cancelSave: () => void;
}

/** `beforeChange` runs when the active file changes (stop a run, clear breakpoints); `setNote` shows messages. */
export function useWorkspace(
  first: { language: PseudocodeLanguage; source: string },
  beforeChange: () => void,
  setNote: (note: Note | null) => void,
): WorkspaceHook {
  const [ws, setWs] = useState(() => initialWorkspace(first.language, first.source));
  const [dialog, setDialog] = useState<WorkspaceHook["dialog"]>(null);
  const current = activeTab(ws);
  // The latest workspace for handlers that run after an await (convert, open), when `ws` would be stale.
  const latest = useRef(ws);
  latest.current = ws;
  const update = (next: Workspace) => {
    latest.current = next;
    setWs(next);
  };
  const changed = (next: Workspace) => {
    beforeChange();
    setNote(null);
    update(next);
  };

  const download = (id: number, as?: { name: string; type: SaveType }) => {
    const tab = latest.current.tabs.find((t) => t.id === id);
    if (tab === undefined) return;
    const ext = as?.type ?? typeOf(tab.language);
    const name = as?.name ?? tab.name;
    downloadText(`${name}.${ext}`, tab.source);
    const language =
      as === undefined || as.type === "txt" ? tab.language : parseFileName(`x.${as.type}`, tab.language).language;
    update(markSaved(latest.current, id, { name, language }));
  };

  return {
    ws,
    current,
    setSource: (source) => {
      update(editActive(latest.current, source));
    },
    setLanguage: (language) => {
      update(setActiveLanguage(latest.current, language));
    },
    newFile: () => {
      changed(openTab(latest.current, { name: "untitled", language: current.language, source: "" }));
    },
    close: (id) => {
      const closing = latest.current.activeId === id;
      const next = closeTab(latest.current, id);
      if (closing) changed(next);
      else update(next);
    },
    switchTo: (id) => {
      if (id !== latest.current.activeId) changed(switchTab(latest.current, id));
    },
    save: () => {
      if (current.named) download(current.id);
      else setDialog({ name: current.name, type: typeOf(current.language) });
    },
    saveAs: () => {
      setDialog({ name: current.name, type: typeOf(current.language) });
    },
    saveAll: () => {
      for (const tab of latest.current.tabs) if (isDirty(tab) || !tab.named) download(tab.id);
    },
    openFiles: () => {
      void pickTextFiles().then((picked) => {
        let next = latest.current;
        for (const f of picked) {
          const { name, language } = parseFileName(f.name, activeTab(next).language);
          next = openTab(next, { name, language, source: f.text, named: true });
        }
        if (picked.length > 0) changed(next);
      });
    },
    convertToPython: () => {
      const from = current.language;
      if (from === "python") return;
      const { name, source } = current;
      // The converter is loaded only now (a dynamic import), so the first page load stays small.
      void import("@sudocode/core/converter").then(({ convertToPython }) => {
        const result = convertToPython(source, from);
        if (!result.ok) {
          setNote({ text: `${result.message} ${result.hint}`, error: true });
          return;
        }
        beforeChange();
        update(openTab(latest.current, { name, language: "python", source: result.code }));
        setNote({
          text: `Converted from ${NAMES[from]} to Python. Your original is still open in its own tab. Run it to check it does the same.`,
        });
      });
    },
    dialog,
    finishSave: (name, type) => {
      setDialog(null);
      download(current.id, { name, type });
    },
    cancelSave: () => {
      setDialog(null);
    },
  };
}
