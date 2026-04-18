# Abstract (draft — 237 words)

Large-language-model coding assistants hallucinate in proportion to
how loosely the surrounding codebase constrains them. Existing agentic
tooling treats the agent as the sole locus of reasoning; the codebase
is just text it reads. We argue the opposite: the codebase should be
the primary instrument, engineered so that agents succeed by default.

We present **MCP Graph Workflow**, an open-source reference
implementation built on the Model Context Protocol. The system
introduces three interlocking constructs. First, the **Harnessability
Score** — a 7-dimension composite (type coverage, test coverage,
architecture fitness, docs, naming, error handling, context density)
that measures how well a codebase supports agent work as a single
0–100 number, with reproducible grade thresholds. Second, the
**Anti-Vibe-Coding lifecycle** — a nine-phase pipeline (ANALYZE →
DESIGN → PLAN → IMPLEMENT → VALIDATE → REVIEW → HANDOFF → DEPLOY →
LISTENING) with deterministic phase gates rooted in INVEST, Definition
of Done, and architecture fitness functions. Third, the **Task
Readiness Score** — a per-task composite of task size, acceptance-
criterion quality, local harness, dependency depth, and historical
issue patterns that drives a Model Router, routing work to cheaper
models when structural context permits. A shared-daemon architecture
cuts process RAM by 55% at five concurrent agents (measured) with
projected 70–80% cost reduction on implementation-heavy workloads.
The implementation carries 7,500+ tests and operates with zero LLM
dependency at runtime.

**Keywords:** agentic AI, software engineering, Model Context Protocol,
harnessability, tool-augmented LLMs, cost-aware model routing, INVEST,
architecture fitness functions, Anti-Vibe-Coding.
