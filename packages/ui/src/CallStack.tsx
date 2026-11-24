// The call stack panel: one row per active call, innermost first (docs/PRODUCT.md, M5).
import type { StackFrame } from "@sudocode/core";

export function CallStack({ stack }: { stack: readonly StackFrame[] }) {
  if (stack.length === 0) return <div className="sc-empty">Pause the program to see the calls it is inside.</div>;
  return (
    <ol className="sc-stack" aria-label="Active calls, innermost first">
      {stack.map((f, i) => (
        <li key={`${String(stack.length - i)}-${f.name}`} aria-current={i === 0 ? "true" : undefined}>
          <span className="sc-frame-name">{f.name}</span>
          <span className="sc-count">{`line ${String(f.line)}`}</span>
        </li>
      ))}
    </ol>
  );
}
