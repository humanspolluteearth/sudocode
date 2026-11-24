// The Quick reference panel: short sections, each with a one-line explanation and a complete example program.
import type { GuideSection } from "@sudocode/core";
import { guideUrl, type GuideId } from "./GuidePage.tsx";

// The design's wording for the link under the snippets.
const FULL_GUIDE: Record<GuideId, string> = {
  edexcel: "Full Edexcel guide and error reference",
  cie: "Full Cambridge guide and built-in functions",
  python: "Full Python guide and error reference",
};

export interface QuickReferenceProps {
  sections: readonly GuideSection[];
  /** Put a section's example in the editor. */
  onUse: (section: GuideSection) => void;
  language?: GuideId | undefined;
  onOpenGuide?: ((guide: GuideId) => void) | undefined;
}

export function QuickReference({ sections, onUse, language, onOpenGuide }: QuickReferenceProps) {
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
      {language !== undefined && (
        <div className="sc-ref-full">
          <a
            href={guideUrl(language)}
            onClick={(e) => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              onOpenGuide?.(language);
            }}
          >
            {FULL_GUIDE[language]}
          </a>
        </div>
      )}
    </section>
  );
}
