// The Python examples and Quick reference for the IDE (M8). Every program is tested (python.test.ts) to run cleanly
// and print the output the test lists, which was checked against CPython 3.12.
import type { Example } from "./edexcel.ts";

const lines = (...rows: string[]): string => rows.join("\n") + "\n";

export const PYTHON_EXAMPLES: readonly Example[] = [
  {
    id: "grade",
    name: "Grade checker",
    code: lines(
      "# Grade checker",
      "mark = 64",
      "if mark >= 70:",
      '    grade = "A"',
      "elif mark >= 50:",
      '    grade = "B"',
      "else:",
      '    grade = "C"',
      'print("Grade:", grade)',
    ),
  },
  {
    id: "list-total",
    name: "List total and largest",
    code: lines(
      "scores = [12, 30, 7, 23]",
      "total = 0",
      "for s in scores:",
      "    total += s",
      'print("Total:", total)',
      'print("Largest:", max(scores))',
    ),
  },
  {
    id: "functions",
    name: "Functions",
    code: lines("def stars(n):", '    return "*" * n', "", "print(stars(4))"),
  },
  {
    id: "dictionary",
    name: "Dictionary",
    code: lines(
      'ages = {"Ama": 15, "Kofi": 16}',
      'ages["Esi"] = 14',
      "for name in ages:",
      '    print(f"{name} is {ages[name]}")',
    ),
  },
  {
    id: "try-except",
    name: "Handling an error",
    code: lines("try:", '    x = int("abc")', "except ValueError:", '    print("Not a number")'),
  },
];

export { PYTHON_GUIDE } from "./python-guide.ts";
