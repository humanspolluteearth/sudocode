import { describe, expect, it } from "vitest";
import { run } from "../../tests/support/run-ir.ts";
import { analyse } from "./engine.ts";

const codes = (source: string): string[] =>
  analyse(source).diagnostics.map((d) => `${d.code} ${String(d.line)}:${String(d.column)}`);

const output = async (source: string): Promise<string> => {
  const { program } = analyse(source);
  if (program === null) throw new Error("program did not compile");
  return (await run(program)).stdout;
};

const ANIMALS = `CLASS Animal
  PRIVATE Name : STRING
  PUBLIC PROCEDURE NEW(N : STRING)
    Name <- N
  ENDPROCEDURE
  PUBLIC FUNCTION Speak() RETURNS STRING
    RETURN "..."
  ENDFUNCTION
  PUBLIC FUNCTION Describe() RETURNS STRING
    RETURN Name & " says " & Speak()
  ENDFUNCTION
ENDCLASS
CLASS Dog INHERITS Animal
  PUBLIC PROCEDURE NEW(N : STRING)
    SUPER.NEW(N)
  ENDPROCEDURE
  PUBLIC FUNCTION Speak() RETURNS STRING
    RETURN "Woof"
  ENDFUNCTION
ENDCLASS
`;

describe("CIE classes (checker)", () => {
  it("CIE-110 a class with an attribute, a constructor and a method is accepted", () => {
    expect(codes(ANIMALS)).toEqual([]);
  });
  it("CIE-110 INHERITS an unknown class is reported at the parent's name", () => {
    expect(codes("CLASS Dog INHERITS Cat\nENDCLASS")).toEqual(["E-CHK-UNKNOWN-CLASS 1:20"]);
  });
  it("CIE-110 a class that is never closed is reported at CLASS", () => {
    expect(codes("CLASS Dog\n  PRIVATE Age : INTEGER\n")).toEqual(["E-SYN-BLOCK-NOT-CLOSED 1:1"]);
  });
  it("CIE-113 NEW of an unknown class is reported at the class name", () => {
    expect(codes("DECLARE X : INTEGER\nX <- NEW Ghost()")).toEqual(["E-CHK-UNKNOWN-CLASS 2:10"]);
  });
  it("CIE-113 the constructor's arguments are checked", () => {
    expect(codes(`${ANIMALS}DECLARE A : Animal\nA <- NEW Animal()`)).toEqual(["E-CHK-ARG-COUNT 22:10"]);
  });
  it("CIE-114 calling a method that does not exist lists the methods", () => {
    expect(codes(`${ANIMALS}DECLARE D : Dog\nD <- NEW Dog("Rex")\nD.Fly()`)).toEqual(["E-CHK-NO-METHOD 23:3"]);
  });
  it("CIE-115 a PRIVATE attribute cannot be read from outside", () => {
    expect(codes(`${ANIMALS}DECLARE D : Dog\nD <- NEW Dog("Rex")\nOUTPUT D.Name`)).toEqual([
      "E-CHK-PRIVATE-MEMBER 23:10",
    ]);
  });
  it("CIE-115 a PRIVATE attribute cannot be assigned from outside", () => {
    expect(codes(`${ANIMALS}DECLARE A : Animal\nA <- NEW Animal("Rex")\nA.Name <- "Max"`)).toEqual([
      "E-CHK-PRIVATE-MEMBER 23:3",
    ]);
  });
  it("CIE-115 a PRIVATE method cannot be called from outside", () => {
    const source =
      "CLASS A\n  PRIVATE PROCEDURE Hide()\n  ENDPROCEDURE\nENDCLASS\nDECLARE X : A\nX <- NEW A()\nX.Hide()";
    expect(codes(source)).toEqual(["E-CHK-PRIVATE-MEMBER 7:3"]);
  });
  it("CIE-116 an object of a subclass fits a variable of its parent", () => {
    expect(codes(`${ANIMALS}DECLARE A : Animal\nA <- NEW Dog("Rex")`)).toEqual([]);
  });
  it("CIE-116 an object of the parent does not fit a variable of its subclass", () => {
    expect(codes(`${ANIMALS}DECLARE D : Dog\nD <- NEW Animal("Rex")`)).toEqual(["E-CHK-TYPE-CHANGE 22:6"]);
  });
  it("CIE-113 SUPER outside a subclass is a syntax error", () => {
    expect(codes("CLASS A\n  PUBLIC PROCEDURE NEW()\n    SUPER.NEW()\n  ENDPROCEDURE\nENDCLASS")).toEqual([
      "E-SYN-EXPECTED 3:10",
    ]);
  });
});

describe("CIE classes (running)", () => {
  it("CIE-111 an attribute set by the constructor keeps its value for later calls", async () => {
    const source = `CLASS Box
  PRIVATE Size : INTEGER
  PUBLIC PROCEDURE NEW(S : INTEGER)
    Size <- S
  ENDPROCEDURE
  PUBLIC FUNCTION Get() RETURNS INTEGER
    RETURN Size
  ENDFUNCTION
ENDCLASS
DECLARE B : Box
B <- NEW Box(7)
OUTPUT B.Get()`;
    expect(await output(source)).toBe("7\n");
  });
  it("CIE-112 a PUBLIC method with a parameter and a result is callable from outside", async () => {
    const source = `CLASS Math
  PUBLIC FUNCTION Twice(N : INTEGER) RETURNS INTEGER
    RETURN N * 2
  ENDFUNCTION
ENDCLASS
DECLARE M : Math
M <- NEW Math()
OUTPUT M.Twice(21)`;
    expect(await output(source)).toBe("42\n");
  });
  it("CIE-113 CIE-114 a constructor argument sets an attribute that a method reads", async () => {
    expect(await output(`${ANIMALS}DECLARE A : Animal\nA <- NEW Animal("Tom")\nOUTPUT A.Describe()`)).toBe(
      "Tom says ...\n",
    );
  });
  it("CIE-116 a method called inside the parent runs the subclass version", async () => {
    expect(await output(`${ANIMALS}DECLARE D : Dog\nD <- NEW Dog("Rex")\nOUTPUT D.Describe()`)).toBe("Rex says Woof\n");
  });
  it("CIE-116 a parent-typed variable holding a Dog speaks like a Dog", async () => {
    expect(await output(`${ANIMALS}DECLARE A : Animal\nA <- NEW Dog("Rex")\nOUTPUT A.Speak()`)).toBe("Woof\n");
  });
  it("CIE-113 two objects of one class keep separate attributes", async () => {
    const source = `${ANIMALS}DECLARE A, B : Animal\nA <- NEW Animal("One")\nB <- NEW Animal("Two")\nOUTPUT A.Describe()\nOUTPUT B.Describe()`;
    expect(await output(source)).toBe("One says ...\nTwo says ...\n");
  });
  it("CIE-113 SUPER.method calls the parent's version", async () => {
    const source = `CLASS A
  PUBLIC FUNCTION Hi() RETURNS STRING
    RETURN "A"
  ENDFUNCTION
ENDCLASS
CLASS B INHERITS A
  PUBLIC FUNCTION Hi() RETURNS STRING
    RETURN SUPER.Hi() & "B"
  ENDFUNCTION
ENDCLASS
DECLARE X : B
X <- NEW B()
OUTPUT X.Hi()`;
    expect(await output(source)).toBe("AB\n");
  });
});
