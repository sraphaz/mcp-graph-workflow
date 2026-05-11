# Karpathy Guidelines

Behavioral guardrails to reduce common LLM coding mistakes. Derived from
[Andrej Karpathy's observations on LLM coding pitfalls](https://x.com/karpathy/status/2015883857489522876)
and ported from upstream `karpathy-skills/CLAUDE.md` (MIT).

**Tradeoff:** these guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding §karpathy-1

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop, name what's confusing, ask.

## 2. Simplicity First §karpathy-2

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" / "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Self-test: "Would a senior engineer call this overcomplicated?" If yes, simplify.

## 3. Surgical Changes §karpathy-3

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution §karpathy-4

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Project Mapping

These guidelines reinforce existing project rules. When in conflict, the project rule wins (it carries the local context).

| Karpathy principle | Existing project anchor |
|---|---|
| 1. Think Before Coding | Memory `feedback_ask_why_before_changing.md`; CLAUDE.md "Code detachment" |
| 2. Simplicity First | System prompt: "Don't add features, refactor, or introduce abstractions beyond what the task requires" |
| 3. Surgical Changes | CLAUDE.md "Non-Regression Rule" (#9: "Do not change behavior of code you didn't intend to touch") |
| 4. Goal-Driven Execution | TDD-first (CLAUDE.md), DoD checks `has_acceptance_criteria` + `ac_quality_pass` |

See also: `.claude/rules/anti-hallucination.md` (forbidden epistemic phrases — complementary lexical guardrail).

## Enforcement

Behavioral, not lexical — these principles do not have stable phrase markers (unlike anti-hallucination). No automated detector. Enforced by:

- Loaded into context via `CLAUDE.md` "Path-Specific Rules" index
- Surfaceable on-demand via skill `.agents/skills/karpathy-guidelines/`
- Human review during code review and DoD checks
