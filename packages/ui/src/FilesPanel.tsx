// The Files panel (Advanced mode): list, create, view, edit, delete, import and export the virtual files that
// READ and WRITE use.
import type { VirtualFiles } from "@sudocode/core";
import { useRef, useState } from "react";
import { findName, validName } from "./files-store.ts";

export interface FilesPanelProps {
  files: VirtualFiles;
  onChange: (name: string, contents: string) => void;
  onDelete: (name: string) => void;
}

export function FilesPanel({ files, onChange, onDelete }: FilesPanelProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const names = Object.keys(files).sort((a, b) => a.localeCompare(b));
  const current = selected !== null && Object.hasOwn(files, selected) ? selected : null;

  const create = () => {
    const name = newName.trim();
    if (!validName(name)) {
      setMessage("Use letters, digits, dot, dash or underscore, e.g. Scores.txt.");
      return;
    }
    if (findName(files, name) !== undefined) {
      setMessage(`${name} already exists.`);
      return;
    }
    onChange(name, "");
    setSelected(name);
    setNewName("");
    setMessage("");
  };
  const exportFile = () => {
    if (current === null) return;
    const url = URL.createObjectURL(new Blob([files[current] ?? ""], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = current;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importFiles = async (list: FileList | null) => {
    for (const file of Array.from(list ?? [])) {
      if (!validName(file.name)) {
        setMessage(`${file.name} was skipped: file names use letters, digits, dot, dash and underscore.`);
        continue;
      }
      onChange(findName(files, file.name) ?? file.name, await file.text());
      setSelected(file.name);
    }
  };

  return (
    <div className="sc-files" aria-label="Files">
      <div className="sc-panel-title">
        <span>Files</span>
        <span className="sc-count">{String(names.length)}</span>
      </div>
      <form
        className="sc-files-new"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <input
          aria-label="New file name"
          placeholder="Scores.txt"
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
          }}
        />
        <button type="submit">Create</button>
        <button
          type="button"
          onClick={() => {
            picker.current?.click();
          }}
        >
          Import
        </button>
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          aria-label="Import files"
          onChange={(e) => {
            void importFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </form>
      {message !== "" && (
        <p role="status" className="sc-files-message">
          {message}
        </p>
      )}
      <ul className="sc-files-list">
        {names.map((name) => (
          <li key={name}>
            <button
              type="button"
              className={name === current ? "on" : ""}
              aria-pressed={name === current}
              onClick={() => {
                setSelected(name);
              }}
            >
              {name}
            </button>
          </li>
        ))}
        {names.length === 0 && <li className="sc-files-empty">No files yet. WRITE creates one, or use Create.</li>}
      </ul>
      {current !== null && (
        <div className="sc-files-edit">
          <textarea
            aria-label={`Contents of ${current}`}
            value={files[current] ?? ""}
            onChange={(e) => {
              onChange(current, e.target.value);
            }}
          />
          <div>
            <button type="button" onClick={exportFile}>
              Export
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete(current);
                setSelected(null);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
