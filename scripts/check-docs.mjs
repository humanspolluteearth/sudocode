// Checks every markdown file: relative links exist, images exist, every image has alt text.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const SKIP = new Set(["node_modules", ".git", "reference", "dist", "target"]);
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    if (SKIP.has(n)) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith(".md")) files.push(p);
  }
})(".");
let bad = 0;
const fail = (f, m) => {
  bad++;
  console.log(`${f}: ${m}`);
};
for (const f of files) {
  const text = readFileSync(f, "utf8").replace(/```[\s\S]*?```/g, "");
  const targets = [];
  for (const m of text.matchAll(/!?\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)) {
    if (m[0].startsWith("!") && !m[1].trim()) fail(f, `image without alt text: ${m[2]}`);
    targets.push(m[2]);
  }
  for (const m of text.matchAll(/<img\b[^>]*>/g)) {
    if (!/alt="[^"]+"/.test(m[0])) fail(f, `<img> without alt: ${m[0].slice(0, 60)}`);
    const s = m[0].match(/src="([^"]+)"/);
    if (s) targets.push(s[1]);
  }
  for (const t of targets) {
    if (/^<?(https?:|mailto:|#)/.test(t)) continue;
    const path = decodeURIComponent(t.split("#")[0]);
    if (path && !existsSync(resolve(dirname(f), path))) fail(f, `broken link: ${t}`);
  }
}
console.log(bad ? `${bad} problem(s) in ${files.length} files` : `OK: ${files.length} markdown files checked`);
process.exitCode = bad ? 1 : 0;
