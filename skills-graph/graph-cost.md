---
name: graph-cost
description: Cost optimization audit using FinOps principles, token budget analysis, CI/CD minute tracking, dependency size impact, and resource efficiency metrics
triggers:
  - graph-cost
version: 1.0.0
author: Diego Nogueira
date: 2026-04-04
---

# graph-cost

Cost optimization audit using FinOps principles, token budget analysis, CI/CD minute tracking, dependency size impact, and resource efficiency metrics. Identifies waste across token consumption, build minutes, bundle size, and storage growth.

## When to Use

- Monthly cost reviews
- When token usage spikes
- When CI/CD bills increase
- Before adding heavy dependencies
- During LISTENING phase for efficiency improvements

## Mandatory Flow

```
token usage analysis -> CI/CD cost -> dependency size -> bundle cost -> resource efficiency -> optimization plan -> report -> write_memory
```

## Workflow

### Step 1: Token Usage Analysis

Review mcp-graph token consumption patterns. Use `mcp__mcp-graph__metrics` for tool usage stats. Analyze token budget via `mcp__mcp-graph__knowledge_stats` budget report. Check session_savings data for compression effectiveness.

Calculate:
- Tokens consumed vs tokens saved per session
- Net token cost per tool invocation
- Compression ratio from tiered context (context-hub)
- Flag tools with highest token cost

### Step 2: CI/CD Cost Tracking

Analyze GitHub Actions usage:
```bash
gh api /repos/{owner}/{repo}/actions/billing
```

Track:
- Workflow minutes consumed
- Billable minutes by OS (Linux 1x, macOS 10x, Windows 2x multiplier)
- Identify expensive workflows (>10min average)
- Compare with previous month
- Flag workflows with high failure rate (wasted minutes)

### Step 3: Dependency Size Impact

Analyze node_modules footprint:
```bash
du -sh node_modules/
npm ls --prod --parseable | wc -l
```

Check:
- Each production dependency size contribution
- Flag dependencies >5MB that could be replaced with lighter alternatives
- Calculate install time impact
- Identify unused dependencies via `depcheck` or manual review
- Compare dependency count trend over last 5 releases

### Step 4: Bundle Cost Analysis

Measure dist/ output size:
```bash
du -sh dist/
```

Analyze:
- Per-feature cost: size added by each module
- Check for duplicate dependencies in bundle
- Identify tree-shaking opportunities
- Compare bundle size trend over last 5 releases
- Flag modules contributing >10% of total bundle size

### Step 5: Resource Efficiency

Check runtime resource usage:
- SQLite database size (`workflow-graph/graph.db`)
- Knowledge store size
- Cache sizes (SemanticCache, ResponseCache, QueryCache)

Flag:
- Databases >100MB
- Caches without eviction policy
- Unbounded growth patterns
- Calculate storage growth rate (MB/week)

### Step 6: Optimization Plan

For each cost area, propose optimizations with estimated savings:

| Area | Optimization | Estimated Savings |
|------|-------------|-------------------|
| Tokens | Compression/caching (existing context-hub features) | % token reduction |
| CI/CD | Caching/parallelism (graph-cicd recommendations) | minutes saved/month |
| Bundle | Tree-shaking/code splitting | KB/MB reduction |
| Storage | Pruning (graph-dependency + knowledge_prune) | MB reclaimed |

Prioritize by ROI (savings / effort).

### Step 7: Cost Report

Generate report and save to memory:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Cost Audit — <date>"
  content: "<cost breakdown, trends, top optimizations, FinOps maturity>"
  tags: ["cost", "finops", "optimization", "audit"]
```

## Output Format

```
Phase: COST AUDIT
Token Cost: N consumed / N saved / N net per session
CI/CD Minutes: N billable / N free (multiplier-adjusted)
Bundle Size: N KB current (trend: +/- N% over 5 releases)
Storage: N MB DB / N MB cache / N MB total (growth: N MB/week)
Top 5 Optimizations:
  1. <optimization> — estimated savings: <value>
  2. <optimization> — estimated savings: <value>
  3. <optimization> — estimated savings: <value>
  4. <optimization> — estimated savings: <value>
  5. <optimization> — estimated savings: <value>
FinOps Maturity: Crawl | Walk | Run
Overall Grade: A-F

Saved to memory: "Cost Audit — <date>"
```

## Anti-Patterns

- Do NOT optimize cost without measuring first — baseline before cutting
- Do NOT remove caching to save memory — caching saves tokens which cost more
- Do NOT ignore CI/CD macOS multiplier — 10x cost vs Linux
- Do NOT skip dependency audit — unused deps cost install time and disk
- Do NOT sacrifice DX for cost — slow builds cost developer time
- Do NOT forget token savings are cumulative — small per-call savings add up
