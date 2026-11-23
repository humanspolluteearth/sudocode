// Runs axe-core on a rendered element and returns the violations (empty means accessible by axe's rules).
import axe from "axe-core";

export async function axeViolations(element: Element): Promise<string[]> {
  const result = await axe.run(element, { rules: { "color-contrast": { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
}
