// The open files ("tabs") of the IDE as plain data, with pure functions to change them. Keeping this out of React
// means the rules (never close the last tab, a tab is "unsaved" when its text differs from the last save) can be
// tested without rendering anything.
import type { PseudocodeLanguage } from "./preferences.ts";

export interface FileTab {
  id: number;
  /** The file name without its extension; the extension follows the language. */
  name: string;
  language: PseudocodeLanguage;
  source: string;
  /** The text as last saved or opened; the tab shows an unsaved dot while `source` differs. */
  savedSource: string;
  /** True once the file has a name the student chose (saved or opened); Save on an unnamed file asks for one. */
  named: boolean;
}

export interface Workspace {
  tabs: readonly FileTab[];
  activeId: number;
  nextId: number;
}

export const EXTENSIONS = { edexcel: "epc", cie: "cpc", python: "py" } as const;

export const fileName = (tab: Pick<FileTab, "name" | "language">): string => `${tab.name}.${EXTENSIONS[tab.language]}`;

export const isDirty = (tab: FileTab): boolean => tab.source !== tab.savedSource;

export function initialWorkspace(language: PseudocodeLanguage, source: string): Workspace {
  return {
    tabs: [{ id: 1, name: "untitled", language, source, savedSource: source, named: false }],
    activeId: 1,
    nextId: 2,
  };
}

/** The active tab. A workspace always has one, so the fallback to the first tab only covers a bad `activeId`. */
export function activeTab(w: Workspace): FileTab {
  const found = w.tabs.find((t) => t.id === w.activeId) ?? w.tabs[0];
  if (found === undefined) throw new Error("A workspace always has at least one tab");
  return found;
}

/** A name not used by another tab of the same language: untitled, untitled 2, untitled 3... */
export function freeName(w: Workspace, language: PseudocodeLanguage, base: string): string {
  const taken = new Set(w.tabs.filter((t) => t.language === language).map((t) => t.name));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${String(n)}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Adds a tab after the others and makes it the active one. A new tab is saved (no dot) until it is edited. */
export function openTab(
  w: Workspace,
  tab: { name: string; language: PseudocodeLanguage; source: string; saved?: boolean; named?: boolean },
): Workspace {
  const added: FileTab = {
    id: w.nextId,
    name: freeName(w, tab.language, tab.name),
    language: tab.language,
    source: tab.source,
    savedSource: tab.saved === false ? "" : tab.source,
    named: tab.named ?? false,
  };
  return { tabs: [...w.tabs, added], activeId: added.id, nextId: w.nextId + 1 };
}

export function switchTab(w: Workspace, id: number): Workspace {
  return w.tabs.some((t) => t.id === id) ? { ...w, activeId: id } : w;
}

const change = (w: Workspace, id: number, patch: Partial<FileTab>): Workspace => ({
  ...w,
  tabs: w.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
});

export const editActive = (w: Workspace, source: string): Workspace => change(w, w.activeId, { source });

export const setActiveLanguage = (w: Workspace, language: PseudocodeLanguage): Workspace =>
  change(w, w.activeId, { language });

/** Marks a tab saved, optionally under a new name and type (Save as). */
export function markSaved(w: Workspace, id: number, as?: { name: string; language: PseudocodeLanguage }): Workspace {
  const tab = w.tabs.find((t) => t.id === id);
  return tab === undefined ? w : change(w, id, { ...as, savedSource: tab.source, named: true });
}

/** Closes a tab; the last one can't be closed. The tab to its left (or right, if first) becomes active. */
export function closeTab(w: Workspace, id: number): Workspace {
  const at = w.tabs.findIndex((t) => t.id === id);
  if (at < 0 || w.tabs.length === 1) return w;
  const tabs = w.tabs.filter((t) => t.id !== id);
  const activeId = w.activeId === id ? (tabs[Math.max(0, at - 1)]?.id ?? w.activeId) : w.activeId;
  return { ...w, tabs, activeId };
}
