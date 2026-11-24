// What each menu holds. Everything here is reachable from the toolbar too, except what the design puts only in
// menus (zoom, theme, language). Items for features that don't exist yet are disabled with a reason.
import type { MenuDef } from "./MenuBar.tsx";
import type { PseudocodeLanguage } from "./preferences.ts";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, type ThemeChoice } from "./Toolbar.tsx";

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
}

const SOON = "Not available yet";

export function buildMenus(a: MenuActions): MenuDef[] {
  const languages: [PseudocodeLanguage, string][] = [
    ["edexcel", "Edexcel pseudocode"],
    ["cie", "Cambridge 9618 pseudocode"],
    ["python", "Python"],
  ];
  const themes: [ThemeChoice, string][] = [
    ["system", "Theme: System"],
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
        { label: "Step over", onSelect: a.onStepOver, disabled: !a.paused, hint: "F10" },
        { label: "Step into", onSelect: a.onStepInto, disabled: !a.paused, hint: "F11" },
        { label: "Step out", onSelect: a.onStepOut, disabled: !a.paused, hint: "Shift+F11" },
        { label: "Pause", onSelect: a.onPause, disabled: !a.running || a.paused },
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
          label: "Zoom in",
          disabled: a.zoom >= ZOOM_MAX,
          onSelect: () => {
            a.onZoom(Math.min(ZOOM_MAX, a.zoom + ZOOM_STEP));
          },
        },
        {
          label: "Zoom out",
          disabled: a.zoom <= ZOOM_MIN,
          onSelect: () => {
            a.onZoom(Math.max(ZOOM_MIN, a.zoom - ZOOM_STEP));
          },
        },
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
