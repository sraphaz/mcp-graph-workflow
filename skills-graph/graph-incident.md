---
name: graph-incident
description: Incident response and postmortem workflow using structured RCA (5 Whys + Timeline), SLA/SLO tracking, runbook generation, and error-to-commit correlation
triggers:
  - graph-incident
version: 1.0.0
author: Diego Nogueira
date: 2026-04-04
---

# graph-incident

Incident response and postmortem workflow using structured RCA (5 Whys + Timeline), SLA/SLO tracking, runbook generation, and error-to-commit correlation. Provides a blameless, systematic approach to incident handling from detection through prevention.

## When to Use

- When a production incident occurs
- During LISTENING phase for postmortem analysis
- When SLA breaches are detected
- When generating runbooks for known failure modes

## Mandatory Flow

```
incident detection → timeline reconstruction → 5 Whys RCA → impact assessment → mitigation → runbook generation → postmortem → action items → write_memory
```

## Workflow

### Step 1: Incident Detection & Classification

Classify severity:

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| SEV1 — Critical | Service down, data loss, security breach | Immediate |
| SEV2 — Major | Degraded service, significant user impact | < 1 hour |
| SEV3 — Minor | Limited impact, workaround available | < 4 hours |
| SEV4 — Cosmetic | No functional impact, visual/UX issue | Next sprint |

Record: what broke, when detected, who reported, what's affected.

Create incident node in the graph:
```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  type: "risk"
  title: "INCIDENT: <short description>"
  tags: ["incident", "<severity>"]
  description: "What: <symptom>\nWhen: <detection time>\nReporter: <who>\nAffected: <scope>"
```

### Step 2: Timeline Reconstruction

Build chronological timeline from git log, deploy history, and error reports:

```bash
git log --since="24 hours" --oneline --format="%h %ai %s"
```

Map the following milestones:
- **Last known good state** — last successful deploy or green CI run
- **First error** — earliest signal of the incident (logs, alerts, user reports)
- **Detection** — when the team became aware
- **Response** — when investigation started
- **Mitigation** — when the bleeding stopped
- **Resolution** — when root cause was fixed

Calculate: Time to Detect (TTD), Time to Respond (TTR), Time to Mitigate (TTM), Time to Resolve.

### Step 3: Root Cause Analysis (5 Whys)

Interactive 5 Whys analysis. Start from the symptom and drill 5 levels deep:

```
Why 1: Why did <symptom> happen?
  → Because <cause 1>
Why 2: Why did <cause 1> happen?
  → Because <cause 2>
Why 3: Why did <cause 2> happen?
  → Because <cause 3>
Why 4: Why did <cause 3> happen?
  → Because <cause 4>
Why 5: Why did <cause 4> happen?
  → Because <root cause>
```

Distinguish:
- **Proximate cause** — what triggered the incident (e.g., bad deploy)
- **Root cause** — why it was possible (e.g., missing test coverage)
- **Contributing factors** — what made it worse (e.g., no rollback procedure)

Document each level with evidence (log lines, commit SHAs, configuration diffs).

### Step 4: Impact Assessment

Quantify the impact:
- **Users affected** — how many users experienced the issue
- **Duration** — total time from first error to resolution
- **Data loss** — any data corrupted or lost
- **Revenue impact** — estimated financial impact if applicable
- **SLA/SLO breach** — which SLOs were violated and by how much

Check system metrics:
```
Tool: mcp__mcp-graph__metrics
```

Check DORA metrics for change failure rate impact:
```
Tool: mcp__mcp-graph__forecast
Params:
  mode: "dora"
```

### Step 5: Mitigation & Fix

Document the immediate mitigation (hotfix, rollback, feature flag, config change).

Link to fix implementation:
```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  type: "task"
  title: "Fix: <root cause description>"
  tags: ["incident-fix", "<severity>"]
```

Use `/graph-fix-bugs` workflow for the structured fix implementation. Ensure the fix node has edges to the incident node:
```
Tool: mcp__mcp-graph__edge
Params:
  from: "<fix-node-id>"
  to: "<incident-node-id>"
  type: "resolves"
```

### Step 6: Runbook Generation

Create a runbook for this failure mode with the following structure:

- **Symptoms to watch for** — alerts, log patterns, user-reported signals
- **Diagnostic steps** — commands, queries, dashboards to confirm the issue
- **Fix procedure** — step-by-step resolution (rollback, hotfix, config change)
- **Escalation path** — when and who to escalate to
- **Prevention measures** — what should be in place to prevent recurrence

Save as memory:
```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Runbook: <incident-name>"
  content: "<runbook content>"
  tags: ["runbook", "incident", "<failure-mode>"]
```

### Step 7: Postmortem Writing

Structure the postmortem document:

1. **Summary** — one paragraph describing what happened
2. **Timeline** — chronological events from Step 2
3. **Root Cause** — 5 Whys analysis from Step 3
4. **Impact** — quantified impact from Step 4
5. **Mitigation** — what was done to stop the bleeding
6. **Lessons Learned** — what went well (detection speed, response time) and what went poorly
7. **Action Items** — specific, assignable follow-up tasks

Blameless — focus on systems not people. Use "the deploy" not "John deployed".

### Step 8: Action Items

Create follow-up tasks in the graph for each action item:

Categories:
- **Preventive measures** — tests, validation, guardrails to prevent recurrence
- **Monitoring improvements** — alerts, dashboards, observability gaps
- **Test gaps** — missing test coverage that would have caught the issue
- **Documentation updates** — runbooks, architecture docs, on-call guides
- **Process changes** — deploy procedures, review checklists

Each action item becomes a node with acceptance criteria:
```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  type: "task"
  title: "Action: <description>"
  tags: ["incident-action", "<category>"]
  acceptanceCriteria: "<measurable criteria>"
```

### Step 9: Knowledge Capture

Index the postmortem into the knowledge store:
```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Postmortem: <incident-name> — <date>"
  content: "<full postmortem>"
  tags: ["postmortem", "incident", "<severity>", "<failure-mode>"]
```

Record error patterns for future `/graph-bug-hunter` scans. Update SLO definitions if the incident revealed unrealistic targets.

## Output Format

```
Phase: INCIDENT RESPONSE
Severity: SEV<1-4> — <classification>
Timeline: First error <time> → Detection <time> → Resolution <time>
MTTR: <duration>
Root Cause: <one-line summary>
Impact: <N users> affected, <duration> downtime, SLA breach: <yes/no>
Runbook: Generated — "Runbook: <name>"
Action Items: N items (N preventive, N monitoring, N tests, N docs)
Postmortem: Saved — "Postmortem: <name>"

Saved to memory: "Postmortem: <incident-name> — <date>"
```

## Anti-Patterns

- Do NOT blame individuals — blameless postmortems only
- Do NOT skip timeline reconstruction — it reveals systemic issues
- Do NOT stop at proximate cause — 5 Whys finds root cause
- Do NOT skip runbook generation — incidents recur
- Do NOT close incident without action items tracked in graph
- Do NOT ignore near-misses — they predict future incidents
- Do NOT delay postmortem beyond 48 hours — details fade
