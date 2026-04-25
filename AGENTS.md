# Agents & Skills

How `mcp-graph` exposes structured help to Claude Code (and other MCP-compatible agent hosts) at runtime.

## What gets shipped

This repo ships **skills**, not Task-style sub-agents. A skill is a markdown file with frontmatter that Claude Code surfaces as a `/<skill-name>` autocomplete entry. When the user types `/graph-plan`, Claude Code loads the corresponding `SKILL.md` body into the session prompt and follows its instructions.

The canonical skill layout is `.agents/skills/<skill-name>/SKILL.md`. The same files are also emitted into `.claude/skills/` by `mg init` so any project consuming this CLI gets the slash-command surface for free — see `tools/cli/src/core/init/emit-skills.ts`.

## Layout

```
.agents/skills/
  graph-analyze/SKILL.md          # ANALYZE phase: PRD, DoR, requirements
  graph-design/SKILL.md           # DESIGN phase: architecture, ADRs
  graph-plan/SKILL.md             # PLAN phase: sprint planning, decomposition
  graph-implement/SKILL.md        # IMPLEMENT phase: TDD red → green → refactor
  graph-validate/SKILL.md         # VALIDATE phase: AC checks, browser flows
  graph-review/SKILL.md           # REVIEW phase: code review, blast radius
  graph-handoff/SKILL.md          # HANDOFF phase: PR + docs
  graph-deploy/SKILL.md           # DEPLOY phase: CI, release, post-release
  graph-listening/SKILL.md        # LISTENING phase: feedback intake
  graph-accessibility/SKILL.md    # specialized: a11y audit
  graph-api-design/SKILL.md       # specialized: REST/GraphQL surface
  graph-architecture/SKILL.md     # specialized: system architecture
  graph-bug-hunter/SKILL.md       # specialized: regression triage
  graph-dependency/SKILL.md       # specialized: dep upgrades
  graph-docs/SKILL.md             # specialized: doc generation
  graph-fix-bugs/SKILL.md         # specialized: targeted bug fix loop
  graph-performance/SKILL.md      # specialized: perf optimization
  graph-prd/SKILL.md              # specialized: PRD authoring
  graph-quality-assurance/SKILL.md
  graph-refactor/SKILL.md
  graph-security/SKILL.md
  graph-tests/SKILL.md
  harness-engineering/SKILL.md    # browser harness operations
  kanban-orchestrator/SKILL.md    # multi-agent kanban coordination
  ui-ux-pro-max/SKILL.md          # design polish
```

25 skills total. The 9 lifecycle phase skills (analyze → listening) cover the canonical `mcp-graph` 9-phase loop documented in `docs/reference/LIFECYCLE.md`. The remaining 16 are specialized helpers a developer or agent can call into when the task at hand matches their description.

## Invocation

In any Claude Code session that has `mcp-graph` initialized (i.e. `mg init` has run, or the project has a `workflow-graph/`):

```
/graph-plan          # plain slash invocation
/graph-implement     # picks up the IMPLEMENT-phase rubric
/harness-engineering # routes to the browser harness skill
```

The skill body itself has a `name`, `description`, optional `triggers`, `version`, `author`, and a `model.prefer` hint. Claude Code reads the frontmatter to decide the autocomplete surface and the instruction body to drive the session.

## Mapping skills ↔ MCP tools

Many skills delegate to MCP tools the parent server exposes. For example, `graph-analyze` uses `analyze(mode: "prd_quality")`, `graph-implement` uses `start_task` / `finish_task`, `harness-engineering` uses `browser_pilot_run` plus the `mg harness` CLI. The full MCP tool catalogue (54 tools post-T4.0) lives at `src/mcp/tools/` — see `src/mcp/tools/taxonomy.ts` for the core / pro / expert tier classification used by the `MCP_GRAPH_PROFILE` filter.

## Updating skills

1. Edit `.agents/skills/<name>/SKILL.md` (frontmatter + body).
2. If the skill is included in the `mg init` emit-list, also update the template literal in `tools/cli/src/core/init/emit-skills.ts` so newly-initialized projects get the latest body.
3. Bump the `version` field in the frontmatter.
4. Re-run `mg init` in a test project to verify the emit copies the updated body into `.claude/skills/`.

## Where there is no `.claude/agents/`

The Claude Code feature called *sub-agents* — definitions under `.claude/agents/<agent>/` invoked via the Task tool — is **not** what this repo ships. We use the slash-command skill surface because it composes better with the rest of the `mcp-graph` MCP tool catalogue: the agent stays in one session, the skills inject context, and the MCP tools persist work into the graph. If a future feature warrants Task-style sub-agents, this doc gains a section then; today the answer is "use skills."
