// The trace table (SH-17): one column per variable in the order they first get a value, plus Output. Each row
// is one assignment or output, with its line, as students draw trace tables on paper.
import type { TraceRow } from "@sudocode/core";

/** Rows past this are counted but not drawn, so a long loop can't freeze a small device. */
export const TRACE_ROWS_SHOWN = 1000;

export interface TraceTableProps {
  rows: readonly TraceRow[];
  /** False when the run didn't record a trace (the panel was hidden when Run was pressed). */
  recorded: boolean;
}

/** The variable columns, in the order each variable is first assigned. */
export function traceColumns(rows: readonly TraceRow[]): string[] {
  const names: string[] = [];
  for (const r of rows) if (r.kind === "assign" && !names.includes(r.variable)) names.push(r.variable);
  return names;
}

export function TraceTable({ rows, recorded }: TraceTableProps) {
  if (!recorded) return <div className="sc-empty">Open this panel before you press Run to record a trace table.</div>;
  if (rows.length === 0) return <div className="sc-empty">Run the program to fill the trace table.</div>;
  const columns = traceColumns(rows);
  const shown = rows.slice(0, TRACE_ROWS_SHOWN);
  return (
    <div className="sc-trace-wrap">
      <table className="sc-table sc-trace">
        <caption className="sc-sr-only">Trace table</caption>
        <thead>
          <tr>
            <th scope="col">Line</th>
            {columns.map((c) => (
              <th scope="col" key={c}>
                {c}
              </th>
            ))}
            <th scope="col">Output</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>
              <td>{r.line}</td>
              {columns.map((c) => (
                <td key={c}>{r.kind === "assign" && r.variable === c ? r.value : ""}</td>
              ))}
              <td>{r.kind === "output" ? r.text : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <div className="sc-empty">{`Showing the first ${String(shown.length)} of ${String(rows.length)} rows.`}</div>
      )}
    </div>
  );
}
