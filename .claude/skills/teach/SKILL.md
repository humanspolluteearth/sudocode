---
name: teach
description: Explain a compiler or interpreter concept, or a piece of this codebase, as a teacher would, with a small exercise. Use when the user asks "how does X work" or "teach me X".
argument-hint: [concept or file]
---

Teach me: $ARGUMENTS

- Start with the idea in 2 to 3 plain sentences, then show where it lives in OUR code (file and function), or say it doesn't exist yet.
- Use a tiny example in CIE or Edexcel pseudocode and trace it through the stages that matter.
- Name the standard term (e.g. "recursive descent", "binding power", "environment", "bytecode") so I can look it up.
- End with one small exercise I can do myself in the codebase (I write the code; you review it afterwards). Don't solve it.
- Don't change any files.
