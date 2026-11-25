# Features

Everything here **exists today**. Things that are not built yet are in the [roadmap](ROADMAP.md).

## Languages

- Edexcel International GCSE (4CP0) pseudocode
- Cambridge 9618 pseudocode
- Python, the syllabus subset (it follows Python 3.12)

Each rule has an ID in the [language spec](language-spec/README.md).

## Writing

- Editor with line numbers and coloured keywords, for each language
- Several tabs open at once
- Keyword buttons above the keyboard on phones and tablets
- Quick reference with examples, search and an **Insert** button

## Running

- Run, Stop and Pause, with a console for output and input
- Runs inside your browser, in the background, so the page does not freeze
- A step limit that stops runaway programs and asks before carrying on
- Python runs on Sudocode's own interpreter. There is no hidden copy of real Python.

## Understanding

- Step over, Continue and Reset; breakpoints
- Step into, Step out and Call stack (Advanced)
- Variables panel and a trace table that records every variable
- Plain-words errors and warnings, each with a hint

## Converting (Advanced)

- Edexcel to Python
- Cambridge to Python
- Edexcel to Cambridge, and Cambridge to Edexcel
- A note lists what changed. Programs that cannot be converted safely are refused with a reason.

## Files

- Save, Save as, Save all, Open
- A pretend file store for programs that read and write files (Advanced)

## Everywhere

- Works in a modern browser on computers, tablets and phones
- Installable, and works offline after the first visit
- Light and dark theme, text size 100% to 150%
- Simple and Advanced modes, with switches for each tool
- Keyboard and screen-reader support
- No accounts, no tracking

## Limits worth knowing

- Pseudocode whole numbers (INTEGER) stop with an error if they get too big. Python integers do not.
- Python to pseudocode conversion is not offered.
- Some parts of each language are left out on purpose. See [Not planned](ROADMAP.md#not-planned).
