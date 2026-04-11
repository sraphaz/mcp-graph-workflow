---
name: nirvana_forge
description: Open core self-analysis — SCAMPER + 6-3-5 brainstorming, scientific benchmarking, Nirvana Score (0-100), and premium roadmap generation for mcp-graph-workflow
triggers:
  - nirvana_forge
version: 1.1.0
author: Diego Nogueira
date: 2026-04-10
---

# nirvana_forge

Analyze **mcp-graph-workflow itself** as an open core product and generate the complete path to "Nirvana" — state-of-the-art performance combined with sustainable monetization. Applies SCAMPER + 6-3-5 brainstorming (108 rapid ideas), benchmarks against 7 successful open core companies, grounds every recommendation in scientific papers/theorems, and creates an actionable roadmap as graph nodes.

## When to Use

- Strategic product planning — defining the open core premium boundary
- Quarterly self-assessment — measuring progress toward Nirvana state
- Before fundraising or launch — generating a data-backed product roadmap
- When evaluating what to keep open vs. what to monetize
- After major milestones — recalculating the Nirvana Score

## Mandatory Flow

```
graph audit → SCAMPER → 6-3-5 brainwriting → open core benchmark → scientific analysis → Nirvana Score → roadmap generation → report → write_memory
```

## Workflow

### Step 1: Graph & Product Audit

Collect the full picture of the current product state.

**Graph statistics:**
```
Tool: mcp__mcp-graph__metrics
Tool: mcp__mcp-graph__knowledge_stats
```

**Node inventory:**
```
Tool: mcp__mcp-graph__list (type: "epic")
Tool: mcp__mcp-graph__list (type: "task", status: "done")
Tool: mcp__mcp-graph__list (type: "task", status: "in_progress")
```

**Architecture visualization:**
```
Tool: mcp__mcp-graph__export (action: "mermaid", format: "flowchart")
```

**Code intelligence:**
```
Tool: mcp__mcp-graph__code_intelligence (action: "stats")
```

Gather and record:
- Total nodes, edges, epics, tasks (done/pending)
- Knowledge store size (memories, docs, captures)
- Code symbols indexed, relationships mapped
- RAG pipeline stats (embeddings, queries, hit rate)
- Current lifecycle phase and sprint velocity
- Stack: TypeScript, SQLite, Commander.js, React, Tailwind, React Flow

### Step 2: SCAMPER Brainstorming

Apply the 7 SCAMPER lenses to the current mcp-graph feature set. For each lens, generate 3-5 ideas:

| Lens | Question | Example Application |
|------|----------|-------------------|
| **S**ubstitute | What component can be replaced with something better? | Replace in-memory TF-IDF with vector embeddings? |
| **C**ombine | What features can be merged for more value? | Combine code intelligence + RAG for code-aware retrieval? |
| **A**dapt | What can be borrowed from other domains? | Adapt Spotify's squad model for multi-agent orchestration? |
| **M**odify | What can be amplified or minimized? | Amplify the dashboard into a full project management UI? |
| **P**ut to other use | What existing feature serves a new market? | Use the knowledge store as a standalone team wiki engine? |
| **E**liminate | What complexity can be removed? | Eliminate deprecated MCP tools to reduce surface area? |
| **R**everse | What flow can be inverted? | Reverse the CLI-first approach into API-first with CLI as client? |

Record all ideas with a viability score (1-5) and effort estimate (S/M/L/XL).

### Step 3: 6-3-5 Brainwriting Simulation

Simulate 6 personas, each generating 3 ideas across 5 rounds (building on previous ideas):

| Persona | Perspective |
|---------|------------|
| **Open Source Maintainer** | Community growth, contributor experience, adoption friction |
| **Enterprise Buyer** | Compliance, SSO, audit logs, SLA, support contracts |
| **Solo Developer** | Speed, simplicity, zero-config, local-first, offline-first |
| **AI/ML Engineer** | RAG quality, embedding models, context window optimization |
| **Product Manager** | Roadmap clarity, metrics, stakeholder reporting, OKRs |
| **DevOps Engineer** | CI/CD integration, observability, infrastructure as code |

For each round:
1. Each persona generates 3 ideas (18 per round)
2. Ideas from round N are passed to round N+1 for building upon
3. After 5 rounds: 90+ ideas total
4. Filter and deduplicate to top 15-20 actionable ideas
5. Cross-reference with SCAMPER output for convergent themes

### Step 4: Open Core Benchmark (7 Cases)

Analyze 7 successful open core companies and extract patterns:

| Company | Model | Open/Premium Split | Key Insight |
|---------|-------|-------------------|-------------|
| **GitLab** | Open Core + SaaS | Core Git + CI free / Security, compliance, planning premium | Single-app strategy — reduce tool sprawl |
| **Elastic** | Open Core + Cloud | Search engine free / ML, security, cloud management premium | API-first monetization — same API, different tiers |
| **MongoDB** | Open Core + Atlas | Database free / Atlas (managed), enterprise security premium | Managed service captures 60%+ revenue |
| **Grafana** | Open Core + Cloud | Dashboards free / Enterprise plugins, cloud, alerting premium | Plugin ecosystem as premium moat |
| **HashiCorp** | Open Core (BSL) | Core tools free / Enterprise features, governance premium | Infrastructure primitives — high switching cost |
| **Supabase** | Open Core + Cloud | Postgres tooling free / Auth, storage, edge functions premium | Developer experience as competitive advantage |
| **PostHog** | Open Core + Cloud | Analytics free / Session replay, feature flags, surveys premium | All-in-one replaces multiple paid tools |

For each, extract:
- Revenue model and pricing tiers
- What stays open vs. what goes premium
- Community engagement strategy
- Developer adoption funnel
- Lessons applicable to mcp-graph-workflow

### Step 5: Scientific Foundation

Ground each recommendation in published research and theorems:

**Performance optimization:**
- **Amdahl's Law** — `Speedup = 1 / ((1 - P) + P/N)` where P = parallelizable fraction. Identify the sequential bottlenecks in the pipeline (SQLite writes, FTS5 indexing) that limit theoretical speedup.
- **Little's Law** — `L = λW` (WIP = throughput × cycle time). Already used in the flow methodology — validate that the current WIP=1 constraint optimizes cycle time.

**Distributed systems:**
- **CAP Theorem** — mcp-graph is local-first (CP). Evaluate trade-offs if adding cloud sync (eventual consistency = AP). Identify which data can tolerate eventual consistency (memories, docs) vs. which requires strong consistency (graph state, status transitions).

**Software architecture:**
- **Modularity Theory (Baldwin & Clark, 2000)** — Score current module coupling. High modularity enables independent premium modules without forking the core.
- **Conway's Law** — System architecture mirrors team structure. For open core: community contributors = core, internal team = premium modules.

**Knowledge retrieval:**
- **GraphRAG (Microsoft, 2024)** — Hybrid graph + vector retrieval outperforms pure vector by 20-30% on complex queries. mcp-graph already has graph structure — evaluate adding vector layer.
- **Hybrid Search (BM25 + Dense, 2023)** — mcp-graph uses BM25 + TF-IDF. Evaluate upgrade to BM25 + dense embeddings for semantic search.

For each paper/theorem, document:
- Current state in mcp-graph
- Gap to state-of-the-art
- Recommended action with expected impact

### Step 6: Nirvana Score Calculation

Score the product across 6 dimensions (weighted total 0-100):

```
Tool: mcp__mcp-graph__metrics
Tool: mcp__mcp-graph__analyze (mode: "coupling")
```

| Dimension | Weight | Score Criteria | Source |
|-----------|--------|---------------|--------|
| **Architecture** | 20% | Module coupling score, layer isolation, cycle-free deps, fitness functions | `analyze(coupling)`, code intelligence |
| **Performance** | 20% | Build time, bundle size, query latency, N+1 count, memory profile | `metrics`, benchmarks |
| **Knowledge Pipeline** | 15% | RAG hit rate, embedding coverage, context compression ratio, FTS5 quality | `knowledge_stats`, RAG traces |
| **Developer Experience** | 15% | Onboarding friction, CLI ergonomics, error message quality, docs coverage | Manual assessment + `metrics` |
| **Monetization Readiness** | 15% | Premium boundary clarity, feature flag infrastructure, license model, pricing | Open core benchmark comparison |
| **Community & Ecosystem** | 15% | Contributor docs, plugin architecture, extension points, MCP tool coverage | GitHub stats + code analysis |

**Grading:**
- **S (95-100):** Nirvana achieved — best-in-class across all dimensions
- **A (85-94):** Near-Nirvana — minor gaps, clear path to close them
- **B (70-84):** Strong foundation — 2-3 dimensions need significant work
- **C (55-69):** Emerging — architecture solid but premium layer undeveloped
- **D (40-54):** Early stage — focus on core before monetization
- **F (< 40):** Foundation needed — critical gaps in core functionality

### Step 7: Roadmap Generation (NirvanaRoadmap Sub-Graph)

Create actionable roadmap nodes in the execution graph:

**Create Epic:**
```
Tool: mcp__mcp-graph__node (action: "add", type: "epic", name: "NirvanaRoadmap — Open Core v2", description: "Modular + event-driven architecture with premium layer. Target Nirvana Score: 95+")
```

**Phase 1 — DESIGN (Architecture):**
```
Tool: mcp__mcp-graph__node (action: "add", type: "task", name: "Define premium module boundary")
Tool: mcp__mcp-graph__node (action: "add", type: "task", name: "Design plugin architecture for extensions")
Tool: mcp__mcp-graph__node (action: "add", type: "task", name: "ADR: open vs premium feature split")
```

**Phase 2 — IMPLEMENT (Core Improvements):**
```
Tool: mcp__mcp-graph__node (action: "add", type: "task", name: "Upgrade search to BM25 + dense embeddings")
Tool: mcp__mcp-graph__node (action: "add", type: "task", name: "Add vector embedding layer to RAG pipeline")
Tool: mcp__mcp-graph__node (action: "add", type: "task", name: "Implement premium feature flag infrastructure")
Tool: mcp__mcp-graph__node (action: "add", type: "task", name: "Optimize SQLite write path (Amdahl bottleneck)")
```

**Phase 3 — VALIDATE (Quality Gates):**
```
Tool: mcp__mcp-graph__node (action: "add", type: "task", name: "Benchmark: Nirvana Score regression test")
Tool: mcp__mcp-graph__node (action: "add", type: "task", name: "E2E: premium vs open feature parity test")
```

**Phase 4 — DEPLOY (Go-to-Market):**
```
Tool: mcp__mcp-graph__node (action: "add", type: "task", name: "Publish pricing page and tier documentation")
Tool: mcp__mcp-graph__node (action: "add", type: "task", name: "Launch community contributor guide")
```

**Link dependencies:**
```
Tool: mcp__mcp-graph__edge (from: <design-tasks>, to: <implement-tasks>, type: "depends_on")
Tool: mcp__mcp-graph__edge (from: <implement-tasks>, to: <validate-tasks>, type: "depends_on")
Tool: mcp__mcp-graph__edge (from: <validate-tasks>, to: <deploy-tasks>, type: "depends_on")
```

Adjust specific tasks based on Steps 2-6 findings. Add premium feature tasks with justification from the benchmark and scientific analysis.

### Step 8: Report & Persist

Save complete analysis to memory:

```
Tool: mcp__mcp-graph__write_memory (title: "NirvanaForge Analysis — <date>", category: "decision", content: <full report>)
```

Export roadmap visualization:
```
Tool: mcp__mcp-graph__export (action: "mermaid", format: "flowchart")
```

## Output Format

```
Phase: NIRVANA FORGE — Open Core Self-Analysis
Product: mcp-graph-workflow

=== Current State ===
Nodes: N total (N done, N in_progress, N ready)
Knowledge: N memories, N docs, N captures
Code Intelligence: N symbols, N relationships
Stack: TypeScript 5.x, SQLite, Commander.js, React 19

=== Brainstorming Results ===
SCAMPER Ideas: N generated (N viable, N high-impact)
6-3-5 Ideas: N generated (N unique after dedup)
Convergent Themes: <top 3 themes>

=== Open Core Benchmark ===
Most Similar Model: <company> (<model type>)
Recommended Split: <what stays open> / <what goes premium>
Pricing Strategy: <recommended approach>

=== Scientific Analysis ===
Amdahl Bottleneck: <identified bottleneck> (P=N%, max speedup=Nx)
CAP Position: <CP/AP/hybrid> — <recommendation>
Modularity Score: N/10 (coupling: N, cohesion: N)
RAG Gap: <current> → <target> (expected +N% retrieval quality)

=== Nirvana Score ===
Architecture:          N/100 (weight: 20%)
Performance:           N/100 (weight: 20%)
Knowledge Pipeline:    N/100 (weight: 15%)
Developer Experience:  N/100 (weight: 15%)
Monetization Ready:    N/100 (weight: 15%)
Community:             N/100 (weight: 15%)
─────────────────────────────────────
TOTAL:                 N/100 — Grade: <S/A/B/C/D/F>

=== Roadmap Created ===
Epic: NirvanaRoadmap — Open Core v2
Tasks: N total (DESIGN: N, IMPLEMENT: N, VALIDATE: N, DEPLOY: N)
Top 3 Actions:
  1. <action> (impact: +N points, effort: S/M/L)
  2. <action> (impact: +N points, effort: S/M/L)
  3. <action> (impact: +N points, effort: S/M/L)

Next Task: DESIGN → Nirvana Core v2 (modular + event-driven + premium layer)

Saved to memory: "NirvanaForge Analysis — <date>"
```

## Anti-Patterns

- Do NOT skip the audit step — you need the full picture before brainstorming
- Do NOT generate ideas without grounding — every recommendation needs a benchmark case or scientific paper
- Do NOT monetize core value — the open source core must remain genuinely useful standalone
- Do NOT create roadmap nodes without dependencies — unlinked tasks become orphans
- Do NOT ignore the Nirvana Score — it is the single metric that tracks progress across runs
- Do NOT copy competitor models blindly — adapt to mcp-graph's local-first, single-developer DNA
- Do NOT over-scope the roadmap — each task must be atomic (completable in ≤2h per XP rules)
- Do NOT run this skill without first having a populated graph — empty graphs produce meaningless scores
