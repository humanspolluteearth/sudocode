// Test setup (browser tests only). The startup dialog shows on every launch until its "Don't show this again" box is
// ticked, so every test that expects to land in the editor would hit it. This reads the stored preferences as if
// that box was ticked, unless a test stores its own `welcomeDone` (the dialog's own tests do).
const KEY = "sudocode.preferences";
const getItem = (Storage.prototype as { getItem: (this: Storage, key: string) => string | null }).getItem;
Storage.prototype.getItem = function (this: Storage, key: string): string | null {
  const raw = getItem.call(this, key);
  if (key !== KEY) return raw;
  try {
    const stored: unknown = raw === null ? {} : JSON.parse(raw);
    if (typeof stored !== "object" || stored === null || "welcomeDone" in stored) return raw;
    return JSON.stringify({ ...stored, welcomeDone: true });
  } catch {
    return raw;
  }
};
