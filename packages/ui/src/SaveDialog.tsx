// Save and Save as: a name and a type (.epc, .cpc, .py, .txt). An in-page dialog, like StepLimitDialog, so it works
// the same in the browser, the desktop shell and tests. Enter saves, Escape cancels.
import { useEffect, useRef, useState } from "react";
import { cleanName, SAVE_TYPES, type SaveType } from "./file-io.ts";

export interface SaveDialogProps {
  name: string;
  type: SaveType;
  onSave: (name: string, type: SaveType) => void;
  onCancel: () => void;
}

export function SaveDialog({ name, type, onSave, onCancel }: SaveDialogProps) {
  const [draft, setDraft] = useState(name);
  const [kind, setKind] = useState<SaveType>(type);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  return (
    <div className="sc-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="sc-save-title">
      <form
        className="sc-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(cleanName(draft), kind);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        <h2 id="sc-save-title">Save file</h2>
        <label className="sc-field">
          File name
          <input
            ref={input}
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
            }}
          />
        </label>
        <label className="sc-field">
          File type
          <select
            value={kind}
            onChange={(e) => {
              setKind(SAVE_TYPES.find((t) => t.type === e.target.value)?.type ?? "txt");
            }}
          >
            {SAVE_TYPES.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <div className="sc-dialog-buttons">
          <button type="submit" className="sc-tb">
            Save
          </button>
          <button type="button" className="sc-tb" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
