---
name: graph-nirvana-community-engine
description: Autonomous community growth — user feedback loops, auto-documentation generation, and open core monetization tracking with conversion metrics
triggers:
  - graph-nirvana-community-engine
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-nirvana-community-engine

Autonomous community growth engine that captures user feedback, auto-generates documentation, and tracks open core monetization metrics. Combines three capabilities: **feedback loop** (capture → classify → integrate), **documentation generator** (README, API docs, changelog, diagrams), and **open core monetization** (feature mapping, conversion tracking, revenue projection).

Unlike manual `graph-docs` and `graph-listening`, this skill is **continuous** — it maintains a living feedback pipeline, keeps docs synchronized with code, and tracks monetization signals proactively.

Integrates into the MAPE-K loop: **Monitor** (capture feedback) → **Analyze** (classify + sentiment) → **Plan** (doc updates + feature mapping) → **Execute** (generate + track) → **Knowledge** (save community trends).

## When to Use

- During LISTENING phase for feedback incorporation
- After any release for changelog and doc updates
- When planning premium features or open core strategy
- When documentation is stale (code changed, docs didn't)
- Periodically (bi-weekly recommended) for community health check
- The user says "feedback loop", "auto docs", "monetization", "community", or "nirvana community"

## Mandatory Flow

```
feedback_ingestion → classification → graph_integration → auto_documentation → diagram_generation → feature_mapping → conversion_metrics → revenue_projection → community_report → write_memory
```

## Workflow

### Step 1: Feedback Ingestion

Capture feedback from available sources:

**GitHub Issues (if accessible):**
- New issues since last scan
- Issue labels, reactions, comment count
- Feature requests vs. bug reports

**Error Logs (self-healing memories):**
```
Tool: mcp__mcp-graph__rag_context
Params:
  query: "error healing feedback"
  topK: 20
```

**Graph Analytics:**
```
Tool: mcp__mcp-graph__metrics
```
- Tasks with high rework rate = pain points
- Frequently blocked dependencies = friction areas
- Long cycle time tasks = complexity signals

**CLI Usage Patterns (if instrumented):**
- Most/least used commands
- Error frequency by command
- Abandoned workflows (started but not completed)

### Step 2: Sentiment & Classification

Classify each feedback item:

| Category | Signal | Priority Heuristic |
|----------|--------|-------------------|
| Bug | Error report, "broken", "doesn't work" | High (blocking users) |
| Feature Request | "would be nice", "can you add", "I wish" | Medium (growth opportunity) |
| Improvement | "slow", "confusing", "hard to", UX friction | Medium (retention risk) |
| Documentation | "how do I", "where is", "unclear" | Low-Medium (onboarding friction) |
| Praise | "great", "love", "thank you" | Informational (track for morale) |

Sentiment scoring: Positive (+1) / Neutral (0) / Negative (-1). Track Net Promoter Score (NPS) trend.

### Step 3: Graph Integration

Create/link feedback nodes in the execution graph:

```
Tool: mcp__mcp-graph__node
Params:
  action: add
  type: idea
  name: "[Feedback] <classified title>"
  description: "<source, category, sentiment, original text>"
  priority: <derived from classification>
  metadata: { "source": "nirvana-community-engine", "category": "<bug|feature|improvement|docs>", "sentiment": "<positive|neutral|negative>" }
```

Link to existing epics/features:
```
Tool: mcp__mcp-graph__edge
Params:
  from: <feedback-node-id>
  to: <related-epic-id>
  type: "related_to"
```

Aggregate: group similar feedback items under a single epic to avoid duplicates.

### Step 4: Auto-Documentation

Generate and update documentation from code + graph state:

**README Sync:**
- Extract project description from package.json
- Generate feature list from graph epics (status: done)
- Update installation instructions from actual build commands
- Sync command reference from CLI help output

**API Documentation:**
- Extract routes from `src/api/routes/*.ts`
- Generate endpoint table (method, path, description)
- Cross-reference with existing `docs/reference/REST-API-REFERENCE.md`

**Changelog:**
- Generate from git log since last release tag
- Categorize: Added, Changed, Fixed, Removed
- Link to graph nodes for each change

**Verification:** Diff generated docs against existing. Only create update tasks for actual discrepancies.

### Step 5: Diagram Generation

Auto-generate visual documentation from graph state:

```
Tool: mcp__mcp-graph__export
Params:
  format: mermaid
```

Generate:
- **Architecture diagram** — Module dependencies from Code Intelligence
- **Execution graph** — Current sprint state (nodes + edges)
- **Feature roadmap** — Epics with status and timeline

Save diagrams to `docs/` directory as `.mmd` files for rendering.

### Step 6: Open Core Feature Mapping

Map features to community (free) vs. premium (paid) tiers:

| Tier | Criteria | Examples |
|------|----------|---------|
| **Community (Free)** | Core functionality, CLI, basic graph | PRD import, task tracking, TDD workflow |
| **Premium (Paid)** | Advanced analytics, multi-user, integrations | DORA dashboards, team velocity, API access |
| **Enterprise** | SSO, audit log, SLA, custom integrations | RBAC, compliance reports, dedicated support |

Create feature map as graph nodes:
```
Tool: mcp__mcp-graph__node
Params:
  action: add
  type: idea
  name: "[Feature Map] <feature name>"
  metadata: { "tier": "<community|premium|enterprise>", "source": "nirvana-community-engine" }
```

### Step 7: Conversion Metrics

Track adoption and conversion signals:

| Metric | Source | Calculation |
|--------|--------|-------------|
| Feature adoption | Graph node access frequency | Unique users × frequency per feature |
| Premium interest | Feature requests for premium features | Count of requests tagged "premium" |
| Conversion funnel | Community → Trial → Premium | Stage transition rates |
| Churn signals | Decreased usage, abandoned workflows | Usage frequency delta per period |
| NPS trend | Sentiment from Step 2 | Rolling 30-day NPS score |

### Step 8: Revenue Projection

Estimate impact of premium features:

| Model | Formula | Use When |
|-------|---------|----------|
| Bottom-up | `interested_users × conversion_rate × price` | Early stage, few data points |
| Cohort-based | `cohort_size × retention_rate^months × ARPU` | Established user base |
| Feature-driven | `feature_demand_score × willingness_to_pay` | Prioritizing premium roadmap |

Output: ranked list of premium features by projected revenue impact.

### Step 9: Community Report & Memory

Generate community health report:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Nirvana Community Engine — <date>"
  content: "<feedback summary, doc status, feature map, conversion metrics, revenue projections, NPS trend>"
  tags: ["nirvana", "community", "feedback", "docs", "monetization", "open-core"]
```

## Output Format

```
Phase: NIRVANA COMMUNITY ENGINE (MAPE-K)
Feedback Captured: N items (N bugs, N features, N improvements, N docs)
Sentiment: NPS X (trend: ↑/↓/→), N positive, N neutral, N negative
Graph Nodes Created: N feedback nodes linked to M epics

Documentation:
  README: synced/stale (N discrepancies)
  API Docs: synced/stale (N endpoints undocumented)
  Changelog: N entries since last release
  Diagrams: N generated/updated

Open Core:
  Feature Map: N community, N premium, N enterprise
  Premium Interest: N requests (top 3: <features>)
  Conversion Signals: N% funnel rate
  Revenue Projection: $X MRR (top feature: <name> = $Y)

Saved to memory: "Nirvana Community Engine — <date>"
```

## Anti-Patterns

- Do NOT auto-generate docs without diffing against existing — overwriting manual docs destroys context
- Do NOT create duplicate feedback nodes — search graph before creating
- Do NOT assume all feedback is actionable — classify and prioritize first
- Do NOT mix community and premium features without clear tier criteria — blurry lines confuse users
- Do NOT project revenue from vanity metrics — use demand signals, not page views
- Do NOT ignore documentation staleness — stale docs are worse than no docs (they mislead)
- Do NOT skip sentiment analysis — knowing HOW users feel is as important as WHAT they say
- Do NOT auto-publish generated docs — create review tasks, let the maintainer approve
