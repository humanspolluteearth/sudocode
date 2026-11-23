// The student's virtual files (docs/language-spec/edexcel.md 2.9). Names are case-insensitive (SH-11), so the
// helpers below compare lowercase names; the name keeps the case the student typed.
// Persistence is IndexedDB (one record holding all files), wrapped so a blocked or missing database just means the
// files last until the tab closes.
import type { VirtualFiles } from "@sudocode/core";

const NAME = /^[A-Za-z0-9_.-]+$/;

export function validName(name: string): boolean {
  return NAME.test(name) && name !== "__proto__";
}

export function findName(files: VirtualFiles, name: string): string | undefined {
  const lower = name.toLowerCase();
  return Object.keys(files).find((n) => n.toLowerCase() === lower);
}

/** Creates or replaces a file (matching an existing name in any case). */
export function putFile(files: VirtualFiles, name: string, contents: string): VirtualFiles {
  const old = findName(files, name);
  return { ...removeFile(files, old ?? name), [name]: contents };
}

export function removeFile(files: VirtualFiles, name: string): VirtualFiles {
  const existing = findName(files, name);
  return Object.fromEntries(Object.entries(files).filter(([n]) => n !== existing));
}

/** Applies the `fileWrite` events of a run. */
export function applyWrite(files: VirtualFiles, name: string, contents: string): VirtualFiles {
  return putFile(files, findName(files, name) ?? name, contents);
}

const DB = "sudocode";
const STORE = "project";
const KEY = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB failed"));
    };
  });
}

function parseFiles(raw: unknown): VirtualFiles {
  if (typeof raw !== "object" || raw === null) return {};
  return Object.fromEntries<string>(
    Object.entries(raw).filter(([name, text]) => typeof text === "string" && validName(name)),
  );
}

export async function loadFiles(): Promise<VirtualFiles> {
  try {
    const db = await open();
    return await new Promise<VirtualFiles>((resolve) => {
      const get = db.transaction(STORE).objectStore(STORE).get(KEY);
      get.onsuccess = () => {
        db.close();
        resolve(parseFiles(get.result));
      };
      get.onerror = () => {
        db.close();
        resolve({});
      };
    });
  } catch {
    return {};
  }
}

export async function saveFiles(files: VirtualFiles): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(files, KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Not saved; the files still work for this session.
  }
}
