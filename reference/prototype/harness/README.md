# Prototype harness (reference only)

Runs the old prototype's interpreters in Node, outside the browser. Used for the milestone 0 audit and for
harvesting tests. Not part of the product; nothing in `packages/` may import from `reference/`.

- `engines.cjs`: the prototype's Edexcel (`PS`), Cambridge (`CIE`) and Python (`PY`) interpreters and converter
  (`CONVERT`), cut from `../prototype-main.js` with a `module.exports` line added.
- `node run.cjs`: runs every bundled example and prints the result.
- `node pydiff.cjs`: runs the Python examples in the prototype and in real CPython (`python3`) and compares.
- `node conv.cjs`: converts the pseudocode examples to Python and checks CPython prints the same output.

The prototype's outputs are NOT expected answers. Expected answers come from `docs/language-spec/` and CPython.
