// Copies the design's Quick reference snippets (sections of titled code samples with notes, and the `noInsert`
// flag) into packages/ui/src/snippets.json. Run by hand when the design changes: `node scripts/gen-snippets.mjs`.
// The three arrays are plain data literals in the read-only prototype; they are evaluated here, never imported.
import { readFileSync, writeFileSync } from "node:fs";

const lines = readFileSync("reference/prototype/design/Main.dc.html", "utf8").split("\n");
const take = (name) => {
  const start = lines.findIndex((l) => l.startsWith(`var ${name} = [`));
  let end = start;
  while (lines[end] !== "];") end++;
  const body = lines
    .slice(start, end + 1)
    .join("\n")
    .replace(`var ${name} =`, "return");
  return new Function(body)();
};
const out = { edexcel: take("GUIDE"), cie: take("CIE_GUIDE"), python: take("PY_GUIDE") };
writeFileSync("packages/ui/src/snippets.json", JSON.stringify(out, null, 1) + "\n");
for (const [k, v] of Object.entries(out))
  console.log(
    k,
    v.length,
    v.reduce((n, s) => n + s.items.length, 0),
  );
