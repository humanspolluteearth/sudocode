// The menu bar (File, Run, Convert, Language, View) from the prototype design. Each menu is a ARIA menubar item
// that opens a list of menuitems; items the app can't do yet are shown disabled with a title, not removed.
import { useEffect, useRef, useState } from "react";

export type MenuEntry =
  | { sep: true }
  | {
      label: string;
      onSelect?: () => void;
      disabled?: boolean;
      /** Why an item is disabled (shown as a tooltip). */
      title?: string;
      /** Shows a tick; the item then has role menuitemradio. */
      checked?: boolean;
      hint?: string;
    };
export interface MenuDef {
  id: string;
  label: string;
  items: readonly MenuEntry[];
}

export function MenuBar({ menus }: { menus: readonly MenuDef[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const bar = useRef<HTMLElement>(null);
  // Click outside or Escape closes the open menu.
  useEffect(() => {
    if (open === null) return;
    const away = (e: MouseEvent) => {
      if (bar.current !== null && !bar.current.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <nav className="sc-menubar" aria-label="Menu bar" ref={bar}>
      <div role="menubar" className="sc-menubar-row">
        {menus.map((m) => (
          <div key={m.id} className="sc-menu">
            <button
              type="button"
              role="menuitem"
              className={`sc-menu-btn${open === m.id ? " open" : ""}`}
              aria-haspopup="menu"
              aria-expanded={open === m.id}
              onClick={() => {
                setOpen(open === m.id ? null : m.id);
              }}
            >
              {m.label}
            </button>
            {open === m.id && (
              <div role="menu" aria-label={m.label} className="sc-menu-list">
                {m.items.map((it, i) =>
                  "sep" in it ? (
                    <div key={i} role="separator" className="sc-menu-sep" />
                  ) : (
                    <button
                      key={it.label}
                      type="button"
                      role={it.checked === undefined ? "menuitem" : "menuitemradio"}
                      aria-checked={it.checked}
                      className="sc-menu-item"
                      disabled={it.disabled}
                      title={it.title}
                      onClick={() => {
                        setOpen(null);
                        it.onSelect?.();
                      }}
                    >
                      <span className="sc-menu-tick" aria-hidden="true">
                        {it.checked === true && "✓"}
                      </span>
                      <span className="sc-menu-label">{it.label}</span>
                      {it.hint !== undefined && <span className="sc-menu-hint">{it.hint}</span>}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}
