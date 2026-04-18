# Preprint outline — MCP Graph Workflow

Target: 12–15 pages, arXiv `cs.SE`, CC-BY-4.0. Written for software-
engineering researchers and practitioners working on agentic AI
systems. Balance theory (novel constructs) with empirical grounding
(the benchmark measured in `scripts/benchmark-daemon-rss.mjs`).

## Title (working)

**MCP Graph Workflow: A Deterministic-First, Harness-Engineered
Pipeline for Agent-Driven Software Development**

Alternate: **Anti-Vibe-Coding: Graph-Backed Agentic Execution with
Measurable Agent Readiness**

## Section 1 — Introduction (1.5 pages)

**Problem statement.** Agentic AI coding assistants hallucinate in
proportion to how loosely the surrounding codebase constrains them.
Existing tooling treats the agent as the sole locus of reasoning; the
codebase is just text it reads. This paper argues the opposite: the
codebase itself should be the primary instrument, engineered so that
agents succeed by default.

**Contributions.**
1. **Harnessability Score** — a 7-dimension composite (0–100) that
   quantifies how well a codebase supports agent work. First
   structural, not behavioral, metric of "agent readiness".
2. **Anti-Vibe-Coding lifecycle** — a nine-phase pipeline (ANALYZE →
   DESIGN → PLAN → IMPLEMENT → VALIDATE → REVIEW → HANDOFF → DEPLOY →
   LISTENING) with deterministic phase gates that prevent skipping
   discipline under time pressure.
3. **Task Readiness Score + Model Router** — a per-task routing
   function that composes five signals to select the cheapest capable
   Claude model, with measured ~55% process-RAM savings via a daemon
   architecture.
4. **Open implementation** — MIT-licensed reference implementation
   with 7,500+ tests, usable today in any MCP-compatible agent host.

## Section 2 — Background (1.5 pages)

- XP's anti-vibe discipline (Beck, 2004) and TDD's Red-Green-Refactor.
- INVEST criteria (Wake, 2003) for user-story quality, extended to AC
  parsing here.
- Architecture fitness functions (Fowler, Parsons, Ford — *Building
  Evolutionary Architectures*, 2017).
- Model Context Protocol (MCP) as the emerging agentic tool-use
  interface (Anthropic, 2024).
- Prior work on agent tooling (LangChain, AutoGen, CrewAI, etc.) —
  what they assume about the host codebase, and why that assumption
  fails in practice.

## Section 3 — Harnessability Score (2 pages)

Formal definition. Seven dimensions, weights (type 25, test 25,
architecture 15, docs 15, naming 10, error handling 5, context density
5), scoring functions, grade scale. Worked example on a real
codebase section. Discussion of why *structural* measurement matters
compared to behavioral evals.

## Section 4 — Anti-Vibe-Coding Lifecycle (2 pages)

Nine phases with gate checks. Definition of Ready (7 checks) and
Definition of Done (8 checks). How the graph enforces each phase
transition. Theory connection: Little's Law (WIP=1), Theory of
Constraints, Lean waste categories mapped onto agent workflows.
Worked example: PRD → tasks → acceptance criteria → implementation.

## Section 5 — Task Readiness Score and Model Router (2 pages)

Five-signal composite scoring (xpSize 35, AC quality 30, harness 15,
dep depth 10, issue-pattern penalty 10). Threshold mapping
(haiku ≥ 85, sonnet [60, 85), opus < 60). Hard overrides
(architectural types, no-testable-AC). Daemon architecture for shared
runtime. Empirical RSS measurement (55% reduction at N=5 agents).
Cost analysis: projected 70–80% cost drop on IMPLEMENT-heavy
workloads if the host honors the hint.

## Section 6 — Implementation (1.5 pages)

TypeScript, SQLite (better-sqlite3 with WAL), MCP SDK, ONNX embeddings
(all-MiniLM-L6-v2 quantized), 45 MCP tools, 9 lifecycle phases.
Architectural fitness: 100% structural separation between the graph
core and the MCP surface; zero framework coupling. Release cadence,
7,500+ tests, deterministic-first policy (graph operations never call
an LLM).

## Section 7 — Evaluation (2 pages)

- Harness Score trajectory of the project itself across the nine
  phases of its own development (self-application).
- RSS benchmark: 5 concurrent agents, legacy vs daemon, 55% reduction
  (see `scripts/benchmark-daemon-rss.mjs`).
- Task Readiness Score calibration: 30-task ground-truth set
  (post-hoc labelled for "could Haiku have done it?") — **if the
  dataset is ready by submission time**, else acknowledged as
  future work.
- Comparison with agentic baselines that do not carry structural
  metadata (LangChain, AutoGen).

## Section 8 — Discussion (1 page)

- Limits of structural metrics: Goodhart's law considerations, how
  the score avoids becoming a target.
- The ethics of cost-aware model routing — risk of underserving
  complex reasoning.
- What the MIT license + citation-required NOTICE protects and what
  it does not.

## Section 9 — Related work, conclusion, bibliography (1.5 pages)

Related: Anthropic's agentic cookbook, LangGraph, evaluating agents
with SWE-bench/SWE-agent, prior structural metrics (SonarQube,
CodeClimate) and why they do not capture agent readiness.
Conclusion: reiterate the three contributions, point at the open
repo, call for replication studies.

## Figures (5 target)

1. Architecture overview (graph → MCP tools → agent host).
2. Nine-phase lifecycle diagram with gate checks.
3. Harnessability radar (7 dimensions) on the project itself.
4. Task Readiness Score flowchart with overrides.
5. RSS benchmark bar chart (legacy vs daemon, N=5).

## Word / page budget reminders

- Introduction is typically 1.5 pages; methods-heavy sections can
  stretch to 2 pages each. Evaluation deserves 2 pages.
- Keep theory to the first half; put the measured benchmark prominently
  in Section 7 so the paper feels empirical, not speculative.
