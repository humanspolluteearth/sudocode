// The Variables panel: every variable of the frame the program is paused in, with its type and value.
// A value that changed since the last pause is highlighted, so the student sees what the last step did.
import type { StackFrame } from "@sudocode/core";

export interface VariablesProps {
  /** The innermost frame at the current pause, or null when the program isn't paused. */
  frame: StackFrame | null;
  /** The same frame's values at the previous pause (name -> value); null for the first pause. */
  previous: ReadonlyMap<string, string> | null;
}

/** Names whose value is new or different from the previous pause. */
export function changedNames(frame: StackFrame, previous: ReadonlyMap<string, string> | null): Set<string> {
  if (previous === null) return new Set();
  return new Set(frame.variables.filter((v) => previous.get(v.name) !== v.value).map((v) => v.name));
}

export function Variables({ frame, previous }: VariablesProps) {
  if (frame === null) {
    return <div className="sc-empty">Variables show here when the program pauses. Set a breakpoint, then Run.</div>;
  }
  if (frame.variables.length === 0) return <div className="sc-empty">No variables yet.</div>;
  const changed = changedNames(frame, previous);
  return (
    <table className="sc-table sc-vars">
      <caption className="sc-sr-only">{`Variables in ${frame.name}`}</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Type</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        {frame.variables.map((v) => (
          <tr key={v.name} className={changed.has(v.name) ? "sc-changed" : undefined}>
            <th scope="row">{v.name}</th>
            <td>{v.type}</td>
            <td>
              {v.value}
              {changed.has(v.name) && <span className="sc-sr-only"> (changed)</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
