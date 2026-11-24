// The three full reference pages (Edexcel, Cambridge, Python). The content is the design's own markup, turned
// into JSON element trees by scripts/gen-guides.mjs and rendered here, so headings, anchors, tables and inline
// spacing are copied from the design, not re-typed. Each page loads on demand (a dynamic import), which keeps
// them out of the first-load bundle. Compiler concept: this renderer walks a tree of nodes, the same shape as
// an AST, and builds output for each node kind.
import { createElement, useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";

export type GuideId = "edexcel" | "cie" | "python";
export const GUIDE_IDS: readonly GuideId[] = ["edexcel", "cie", "python"];

/** A node of the design markup: a tag, its attributes, and children (elements or text). */
export interface GuideNode {
  t: string;
  a?: Record<string, string>;
  c?: (GuideNode | string)[];
}

const LOADERS: Record<GuideId, () => Promise<{ default: GuideNode }>> = {
  edexcel: () => import("./guides/edexcel.json"),
  cie: () => import("./guides/cie.json"),
  python: () => import("./guides/python.json"),
};

// The design's pages link to each other by file name; in the app those are routes.
const LINKS: Record<string, GuideId | "ide"> = {
  "Main.dc.html": "ide",
  "Guide.dc.html": "edexcel",
  "CambridgeGuide.dc.html": "cie",
  "PythonGuide.dc.html": "python",
};

/** The address of a guide page, e.g. `?guide=cie`. */
export const guideUrl = (id: GuideId): string => `?guide=${id}`;

export function guideFromSearch(search: string): GuideId | null {
  const value = new URLSearchParams(search).get("guide");
  return GUIDE_IDS.find((id) => id === value) ?? null;
}

/** "margin: 0; color: var(--fg3)" becomes a React style object. */
export function parseStyle(css: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const at = decl.indexOf(":");
    if (at < 0) continue;
    const name = decl.slice(0, at).trim();
    const value = decl.slice(at + 1).trim();
    if (name === "") continue;
    style[name.startsWith("--") ? name : name.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase())] = value;
  }
  return style;
}

const PROP_NAMES: Record<string, string> = { class: "className", colspan: "colSpan", rowspan: "rowSpan" };

function render(node: GuideNode | string, key: number, go: (target: GuideId | "ide") => void): ReactNode {
  if (typeof node === "string") return node;
  const props: Record<string, unknown> = { key };
  for (const [name, value] of Object.entries(node.a ?? {})) {
    if (name === "style") props["style"] = parseStyle(value);
    else if (name === "href" && value in LINKS) {
      const target = LINKS[value] as GuideId | "ide";
      props["href"] = target === "ide" ? "?" : guideUrl(target);
      props["onClick"] = (e: MouseEvent) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        go(target);
      };
    } else props[PROP_NAMES[name] ?? name] = value;
  }
  // The design scrolls wide tables and code sideways; keyboard users need to be able to focus them to scroll.
  if (/overflow-x:\s*auto/.test(node.a?.["style"] ?? "")) props["tabIndex"] = 0;
  const children = (node.c ?? []).map((child, i) => render(child, i, go));
  return createElement(node.t, props, ...children);
}

export interface GuidePageProps {
  guide: GuideId;
  /** "ide" returns to the editor; a guide id opens that guide. */
  onNavigate: (target: GuideId | "ide") => void;
  themeClass: string;
}

export function GuidePage({ guide, onNavigate, themeClass }: GuidePageProps) {
  const [loaded, setLoaded] = useState<{ guide: GuideId; root: GuideNode } | null>(null);
  useEffect(() => {
    let live = true;
    void LOADERS[guide]().then((m) => {
      if (live) setLoaded({ guide, root: m.default });
    });
    return () => {
      live = false;
    };
  }, [guide]);
  const ready = loaded?.guide === guide ? loaded.root : null;
  // A link such as ?guide=cie#s3 scrolls to its section once the page has loaded.
  useEffect(() => {
    if (ready === null) return;
    const id = globalThis.location.hash.slice(1);
    if (id !== "") globalThis.document.getElementById(id)?.scrollIntoView();
    else globalThis.scrollTo(0, 0);
  }, [ready]);
  if (ready === null) {
    return (
      <div className={`sc-root sc-guide ${themeClass}`} role="status">
        Loading the guide…
      </div>
    );
  }
  const { a, c } = ready;
  const rest = Object.fromEntries(Object.entries(a ?? {}).filter(([k]) => k !== "class"));
  return (
    <div className={`sc-root sc-guide ${themeClass}`}>{render({ t: "div", a: rest, c: c ?? [] }, 0, onNavigate)}</div>
  );
}
