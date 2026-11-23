// The Edexcel examples in the IDE's Examples menu (language content, so they live with the engine and are tested here). They come from the prototype, rewritten to the spec: single-quoted
// strings (EDX-06), `SEND ... TO DISPLAY` with one value (EDX-71), no whole-array SEND (EDX-75). Input is not in
// M3, so values that were typed are set in the first lines instead (see docs/review/M3.md).
export interface Example {
  id: string;
  name: string;
  code: string;
}

const lines = (...rows: string[]): string => rows.join("\n") + "\n";

export const EDEXCEL_EXAMPLES: readonly Example[] = [
  {
    id: "grade",
    name: "Grade checker",
    code: lines(
      "# Grade checker",
      "SET name TO 'Amira'",
      "SET mark TO 64",
      "",
      "IF mark >= 70 THEN",
      "    SET grade TO 'A'",
      "ELSE",
      "    IF mark >= 50 THEN",
      "        SET grade TO 'B'",
      "    ELSE",
      "        SET grade TO 'C'",
      "    END IF",
      "END IF",
      "",
      "SEND name & ' got grade ' & grade TO DISPLAY",
    ),
  },
  {
    id: "times",
    name: "Times table",
    code: lines(
      "# Times table",
      "SET n TO 7",
      "FOR i FROM 1 TO 12 DO",
      "    SEND i & ' x ' & n & ' = ' & i * n TO DISPLAY",
      "END FOR",
    ),
  },
  {
    id: "guess",
    name: "Guessing game",
    code: lines(
      "# Guessing game: the guesses are listed here until input is added",
      "SET guesses TO [3, 9, 7]",
      "SET secret TO 7",
      "SET tries TO 0",
      "REPEAT",
      "    SET guess TO guesses[tries]",
      "    SET tries TO tries + 1",
      "    IF guess < secret THEN",
      "        SEND 'Too low' TO DISPLAY",
      "    ELSE",
      "        IF guess > secret THEN",
      "            SEND 'Too high' TO DISPLAY",
      "        END IF",
      "    END IF",
      "UNTIL guess = secret",
      "SEND 'Got it in ' & tries & ' tries' TO DISPLAY",
    ),
  },
  {
    id: "bubble",
    name: "Bubble sort",
    code: lines(
      "# Bubble sort",
      "SET nums TO [29, 4, 17, 8, 42, 15]",
      "SET swapped TO TRUE",
      "WHILE swapped = TRUE DO",
      "    SET swapped TO FALSE",
      "    FOR i FROM 0 TO LENGTH(nums) - 2 DO",
      "        IF nums[i] > nums[i + 1] THEN",
      "            SET temp TO nums[i]",
      "            SET nums[i] TO nums[i + 1]",
      "            SET nums[i + 1] TO temp",
      "            SET swapped TO TRUE",
      "        END IF",
      "    END FOR",
      "END WHILE",
      "FOR EACH n FROM nums DO",
      "    SEND n TO DISPLAY",
      "END FOREACH",
    ),
  },
  {
    id: "bug",
    name: "Find the bug: average",
    code: lines(
      "# Find the bug: this stops with an error. Can you see why?",
      "SET scores TO [12, 18, 9, 15]",
      "SET total TO 0",
      "FOR i FROM 0 TO LENGTH(scores) DO",
      "    SET total TO total + scores[i]",
      "END FOR",
      "SEND 'Average: ' & total / LENGTH(scores) TO DISPLAY",
    ),
  },
];

/**
 * Examples that need FUNCTION and PROCEDURE. The engine reports them as "not supported yet" for now, so they are
 * not in the menu; move them into EDEXCEL_EXAMPLES when subprograms land (docs/review/M3.md).
 */
export const SUBPROGRAM_EXAMPLES: readonly Example[] = [
  {
    id: "search",
    name: "Linear search (function)",
    code: lines(
      "# Linear search",
      "FUNCTION search(list, target)",
      "BEGIN FUNCTION",
      "    FOR i FROM 0 TO LENGTH(list) - 1 DO",
      "        IF list[i] = target THEN",
      "            RETURN i",
      "        END IF",
      "    END FOR",
      "    RETURN -1",
      "END FUNCTION",
      "",
      "SET names TO ['Ali', 'Bea', 'Cal', 'Dev']",
      "SET wanted TO 'Cal'",
      "SET pos TO search(names, wanted)",
      "IF pos = -1 THEN",
      "    SEND wanted & ' was not found' TO DISPLAY",
      "ELSE",
      "    SEND wanted & ' is at index ' & pos TO DISPLAY",
      "END IF",
    ),
  },
  {
    id: "total",
    name: "Running total (procedure)",
    code: lines(
      "# Running total",
      "SET total TO 0",
      "",
      "PROCEDURE addScore(points)",
      "BEGIN PROCEDURE",
      "    SET total TO total + points",
      "    SEND 'Added ' & points & ', total is now ' & total TO DISPLAY",
      "END PROCEDURE",
      "",
      "FOR EACH s FROM [10, 25, 5] DO",
      "    addScore(s)",
      "END FOREACH",
    ),
  },
];
