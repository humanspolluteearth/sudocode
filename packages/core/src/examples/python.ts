// The Python examples and Quick reference for the IDE (M8). Every program is tested (python.test.ts) to run cleanly
// and print the output the test lists, which was checked against CPython 3.12.
import type { Example } from "./edexcel.ts";
import type { GuideSection } from "./cie-guide.ts";

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

export const PYTHON_GUIDE: readonly GuideSection[] = [
  {
    title: "Variables and output",
    text: "A name is made by assigning to it; there is no declaration. print() shows values separated by spaces.",
    code: lines('name = "Sam"', "age = 15", 'print(name, "is", age)'),
  },
  {
    title: "Input",
    text: "input() always gives text; convert it with int() or float() when you need a number.",
    code: lines('age = int(input("Age? "))', 'print("Next year:", age + 1)'),
  },
  {
    title: "Selection",
    text: "if, elif and else. The indented lines under each are its body.",
    code: lines("n = 5", "if n > 3:", '    print("big")', "else:", '    print("small")'),
  },
  {
    title: "Loops",
    text: "for repeats over a range or a list; range(1, 4) is 1, 2, 3 (it stops before the end). while repeats while a test is true.",
    code: lines("for i in range(1, 4):", "    print(i)", "n = 3", "while n > 0:", "    n -= 1", "print(n)"),
  },
  {
    title: "Lists",
    text: "A list keeps items in order. Count from 0. Negative numbers count from the end.",
    code: lines("xs = [4, 8, 15]", "xs.append(16)", "print(xs[0], xs[-1], len(xs))", "print([x * 2 for x in xs])"),
  },
  {
    title: "Dictionaries",
    text: "A dictionary looks values up by key.",
    code: lines('d = {"a": 1}', 'd["b"] = 2', "print(d, len(d))", 'print(d.get("c", 0))'),
  },
  {
    title: "Functions",
    text: "def makes a function; return gives a value back.",
    code: lines("def square(n):", "    return n * n", "", "print(square(7))"),
  },
  {
    title: "Errors",
    text: "try / except catches an error by its Python name instead of stopping the program.",
    code: lines("try:", "    print(1 / 0)", "except ZeroDivisionError:", '    print("cannot divide by zero")'),
  },
];
