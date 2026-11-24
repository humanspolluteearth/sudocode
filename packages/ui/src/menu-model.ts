// What each menu holds. Everything here is reachable from the toolbar too, except what the design puts only in
// menus (zoom, theme, language). Items for features that don't exist yet are disabled with a reason.
import type { MenuDef } from "./MenuBar.tsx";
import type { PseudocodeLanguage } from "./preferences.ts";
import type { SideTab } from "./SidePanel.tsx";
import { nextZoom, ZOOM_MAX, ZOOM_MIN, type ThemeChoice } from "./Toolbar.tsx";

const ZOOM_PRESETS = [100, 110, 125, 150] as const;

export interface MenuActions {
  running: boolean;
  paused: boolean;
  canRun: boolean;
  onRun: () => void;
  onStop: () => void;
  onContinue: () => void;
  onStepOver: () => void;
  onStepInto: () => void;
  onStepOut: () => void;
  onPause: () => void;
  language: PseudocodeLanguage;
  onLanguage: (language: PseudocodeLanguage) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  theme: ThemeChoice;
  onTheme: (theme: ThemeChoice) => void;
  /** The side panel tab on show, and a way to switch it (View > Debugger, Quick reference). */
  sideTab: SideTab;
  onSideTab: (tab: SideTab) => void;
  onClearConsole: () => void;
  /** How many breakpoints are set; "Clear all breakpoints" is disabled at 0. */
  breakpointCount: number;
  onClearBreakpoints: () => void;
}

const SOON = "Not available yet";

export function buildMenus(a: MenuActions): MenuDef[] {
  const languages: [PseudocodeLanguage, string][] = [
    ["edexcel", "Edexcel pseudocode"],
    ["cie", "Cambridge 9618 pseudocode"],
    ["python", "Python"],
  ];
  const themes: [ThemeChoice, string][] = [
    ["system", "Match system theme"],
    ["light", "Theme: Light"],
    ["dark", "Theme: Dark"],
  ];
  return [
    {
      id: "file",
      label: "File",
      items: [
        { label: "New file", disabled: true, title: SOON },
        { label: "Open…", disabled: true, title: SOON },
        { sep: true },
        { label: "Save", disabled: true, title: SOON, hint: "Ctrl+S" },
      ],
    },
    {
      id: "run",
      label: "Run",
      items: [
        { label: "Run", onSelect: a.onRun, disabled: a.running || !a.canRun, hint: "F5" },
        { label: "Stop", onSelect: a.onStop, disabled: !a.running, hint: "Shift+F5" },
        { sep: true },
        { label: "Continue", onSelect: a.onContinue, disabled: !a.paused, hint: "F8" },
        { label: "Step over", onSelect: a.onStepOver, disabled: !a.paused && (a.running || !a.canRun), hint: "F10" },
        { label: "Step into", onSelect: a.onStepInto, disabled: !a.paused && (a.running || !a.canRun), hint: "F11" },
        { label: "Step out", onSelect: a.onStepOut, disabled: !a.paused, hint: "Shift+F11" },
        { label: "Pause", onSelect: a.onPause, disabled: !a.running || a.paused },
        { sep: true },
        { label: "Clear all breakpoints", onSelect: a.onClearBreakpoints, disabled: a.breakpointCount === 0 },
      ],
    },
    {
      id: "convert",
      label: "Convert",
      items: [
        { label: "Convert to Python", disabled: true, title: SOON },
        { label: "Convert to Cambridge 9618 pseudocode", disabled: true, title: SOON },
      ],
    },
    {
      id: "language",
      label: "Language",
      items: languages.map(([id, name]) => ({
        label: name,
        checked: a.language === id,
        onSelect: () => {
          a.onLanguage(id);
        },
      })),
    },
    {
      id: "view",
      label: "View",
      items: [
        {
          label: "Debugger",
          checked: a.sideTab === "debugger",
          onSelect: () => {
            a.onSideTab("debugger");
          },
        },
        {
          label: "Quick reference",
          checked: a.sideTab === "reference",
          onSelect: () => {
            a.onSideTab("reference");
          },
        },
        { sep: true },
        { label: "Clear console", onSelect: a.onClearConsole },
        { sep: true },
        {
          label: "Zoom in",
          hint: "Ctrl+=",
          disabled: a.zoom >= ZOOM_MAX,
          onSelect: () => {
            a.onZoom(nextZoom(a.zoom, 1));
          },
        },
        {
          label: "Zoom out",
          hint: "Ctrl+-",
          disabled: a.zoom <= ZOOM_MIN,
          onSelect: () => {
            a.onZoom(nextZoom(a.zoom, -1));
          },
        },
        {
          label: "Actual size",
          hint: "Ctrl+0",
          disabled: a.zoom === 100,
          onSelect: () => {
            a.onZoom(100);
          },
        },
        ...ZOOM_PRESETS.map((z) => ({
          label: `Zoom ${String(z)}%`,
          checked: a.zoom === z,
          onSelect: () => {
            a.onZoom(z);
          },
        })),
        { sep: true },
        ...themes.map(([id, label]) => ({
          label,
          checked: a.theme === id,
          onSelect: () => {
            a.onTheme(id);
          },
        })),
      ],
    },
  ];
}
