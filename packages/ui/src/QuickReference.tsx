// The Quick reference panel: short sections, each with a one-line explanation and a complete example program.
import type { GuideSection } from "@sudocode/core";

export interface QuickReferenceProps {
  sections: readonly GuideSection[];
  /** Put a section's example in the editor. */
  onUse: (section: GuideSection) => void;
}

export function QuickReference({ sections, onUse }: QuickReferenceProps) {
  return (
    <section aria-label="Quick reference" className="sc-reference">
      {sections.map((s) => (
        <article key={s.title} className="sc-ref-section">
          <h3>{s.title}</h3>
          <p>{s.text}</p>
          <pre>
            <code>{s.code}</code>
          </pre>
          <button
            type="button"
            className="sc-tb"
            aria-label={`Use this example: ${s.title}`}
            onClick={() => {
              onUse(s);
            }}
          >
            Use this example
          </button>
        </article>
      ))}
    </section>
  );
}
