import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Proves the three full guide pages (packages/ui/src/guides/*.json, made by scripts/gen-guides.mjs) contain every
// heading, anchor, link, table and code sample that the design's markup has. The design file is read as text only.
interface Node {
  t: string;
  a?: Record<string, string>;
  c?: (Node | string)[];
}
const PAGES = [
  ["edexcel", "Guide.dc.html"],
  ["cie", "CambridgeGuide.dc.html"],
  ["python", "PythonGuide.dc.html"],
] as const;

const decode = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
// Text outside tags, by scanning characters (no regex, so nothing is half-sanitised).
const stripTags = (html: string): string => {
  let out = "";
  let inTag = false;
  for (const ch of html) {
    if (ch === "<") inTag = true;
    else if (ch === ">" && inTag) inTag = false;
    else if (!inTag) out += ch;
  }
  return out;
};
// Cuts every <script>…</script> block, matched without regard to case.
const dropScripts = (html: string): string => {
  let out = html;
  for (;;) {
    const start = out.toLowerCase().indexOf("<script");
    if (start < 0) return out;
    const end = out.toLowerCase().indexOf("</script", start);
    const close = end < 0 ? -1 : out.indexOf(">", end);
    out = out.slice(0, start) + (close < 0 ? "" : out.slice(close + 1));
  }
};
const plain = (html: string): string => decode(stripTags(html)).replace(/\s+/g, " ").trim();
const walk = (n: Node | string, visit: (n: Node) => void): void => {
  if (typeof n === "string") return;
  visit(n);
  n.c?.forEach((child) => {
    walk(child, visit);
  });
};
const text = (n: Node | string): string => (typeof n === "string" ? n : (n.c ?? []).map(text).join(""));

describe.each(PAGES)("MISC %s guide page", (id, file) => {
  const raw = readFileSync(`reference/prototype/design/${file}`, "utf8");
  const design = dropScripts(raw);
  const root = JSON.parse(readFileSync(`packages/ui/src/guides/${id}.json`, "utf8")) as Node;
  const nodes: Node[] = [];
  walk(root, (n) => nodes.push(n));

  it(`MISC ${id}: every heading in the design is in the page`, () => {
    const wanted = [...design.matchAll(/<h([12])[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => plain(m[2] ?? ""));
    const got = nodes.filter((n) => n.t === "h1" || n.t === "h2").map((n) => text(n).replace(/\s+/g, " ").trim());
    expect(wanted.length).toBeGreaterThan(5);
    expect(got).toEqual(wanted);
  });

  it(`MISC ${id}: every anchor id and every link in the design is in the page`, () => {
    const ids = [...design.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const hrefs = [...design.matchAll(/\shref="([^"]+)"/g)].map((m) => m[1]).filter((h) => !h?.startsWith("https:"));
    expect(nodes.flatMap((n) => (n.a?.["id"] !== undefined ? [n.a["id"]] : []))).toEqual(ids);
    expect(nodes.flatMap((n) => (n.t === "a" && n.a?.["href"] !== undefined ? [n.a["href"]] : []))).toEqual(hrefs);
  });

  it(`MISC ${id}: contents links all point at a section that exists`, () => {
    const anchors = nodes.flatMap((n) => (n.t === "a" && n.a?.["href"]?.startsWith("#") ? [n.a["href"].slice(1)] : []));
    const ids = new Set(nodes.flatMap((n) => (n.a?.["id"] !== undefined ? [n.a["id"]] : [])));
    expect(anchors.length).toBeGreaterThan(5);
    for (const a of anchors) expect(ids.has(a), a).toBe(true);
  });

  it(`MISC ${id}: tables, code samples and list items match the design`, () => {
    const count = (tag: string): number => nodes.filter((n) => n.t === tag).length;
    const inDesign = (tag: string): number => [...design.matchAll(new RegExp(`<${tag}[\\s>]`, "g"))].length;
    for (const tag of ["table", "tr", "th", "td", "pre", "code", "li", "section", "p"]) {
      expect(count(tag), tag).toBe(inDesign(tag));
    }
    const samples = [...design.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/g)].map((m) => decode(stripTags(m[1] ?? "")));
    expect(nodes.filter((n) => n.t === "pre").map(text)).toEqual(samples);
  });
});
