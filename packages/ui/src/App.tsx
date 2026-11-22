// The IDE's root component. M1: just the name; the editor and console arrive in M3.
// The UI depends on @sudocode/core for types and the Runner only (apps -> ui -> core).
import { LANGUAGES, type Language } from "@sudocode/core";

const LANGUAGE_LABELS: Record<Language, string> = {
  edexcel: "Edexcel IGCSE pseudocode",
  cie: "Cambridge 9618 pseudocode",
  python: "Python",
};

export function App() {
  return (
    <main>
      <h1>Sudocode</h1>
      <p>Write, run and debug programs in:</p>
      <ul>
        {LANGUAGES.map((language) => (
          <li key={language}>{LANGUAGE_LABELS[language]}</li>
        ))}
      </ul>
    </main>
  );
}
