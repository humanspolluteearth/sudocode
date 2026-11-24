// The IDE's tools and which are on (docs/PRODUCT.md). A tool is on when the student has not switched it off in
// Settings AND the current mode allows it: Simple mode hides the Advanced-only tools whatever the switches say.

export type ToolId =
  "problems" | "variables" | "breakpoints" | "traceTable" | "reference" | "stepInto" | "files" | "converter";

export const TOOLS: readonly { id: ToolId; label: string; advancedOnly: boolean }[] = [
  { id: "problems", label: "Problems list", advancedOnly: false },
  { id: "variables", label: "Variables panel", advancedOnly: false },
  { id: "breakpoints", label: "Breakpoints and Step over", advancedOnly: false },
  { id: "traceTable", label: "Trace table", advancedOnly: false },
  { id: "reference", label: "Quick reference", advancedOnly: false },
  { id: "stepInto", label: "Step into, Step out and Call stack", advancedOnly: true },
  { id: "files", label: "Files panel", advancedOnly: true },
  { id: "converter", label: "Converter", advancedOnly: true },
];

export type ToolFlags = Readonly<Record<ToolId, boolean>>;

/** Every tool on: what a component assumes when it is given no flags. */
export const ALL_TOOLS: ToolFlags = {
  problems: true,
  variables: true,
  breakpoints: true,
  traceTable: true,
  reference: true,
  stepInto: true,
  files: true,
  converter: true,
};

export function toolFlags(advanced: boolean, off: readonly ToolId[]): ToolFlags {
  const flags = { ...ALL_TOOLS } as Record<ToolId, boolean>;
  for (const t of TOOLS) flags[t.id] = !off.includes(t.id) && (advanced || !t.advancedOnly);
  return flags;
}

export function parseToolList(value: unknown): ToolId[] {
  if (!Array.isArray(value)) return [];
  return TOOLS.map((t) => t.id).filter((id) => value.includes(id));
}
