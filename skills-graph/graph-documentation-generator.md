---
name: graph-documentation-generator
description: Autonomous documentation generation and maintenance — detects undocumented modules, generates JSDoc/API docs, and keeps documentation in sync with code
triggers:
  - graph-documentation-generator
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-documentation-generator

Autonomous documentation generation and maintenance for the mcp-graph codebase. Unlike `graph-docs` (manual documentation workflow), this skill autonomously detects undocumented modules, generates JSDoc comments, API endpoint documentation, and architecture overviews, then keeps all documentation in sync with code changes. Ensures documentation never drifts from implementation.

## When to Use

- Proactively triggered after every epic completion to document new modules
- When Code Intelligence detects public functions without JSDoc comments
- When API routes are added or modified without corresponding documentation
- After a major refactoring that changes module interfaces
- The user says "generate docs", "auto-document", "documentation generator", or "sync docs"
- Autonomously triggered when >10 public exported functions lack JSDoc comments

## Mandatory Flow

```
scan(code_intelligence + exports) → detect(undocumented + stale) → generate(JSDoc + API + architecture) → validate(accuracy check) → sync(update references) → write_memory
```

## Workflow

### Step 1: Scan — Inventory All Documentable Entities

Use Code Intelligence to build a complete inventory of documentable entities:

```
Tool: mcp__mcp-graph__code_intelligence (action: "analyze")
```

```
Tool: mcp__mcp-graph__search (query: "exported functions and interfaces")
```

Documentable entity types:

| Entity Type | Where Found | Doc Format |
|-------------|-------------|------------|
| Public functions | `export function` | JSDoc with `@param`, `@returns`, `@throws` |
| Public interfaces/types | `export interface`, `export type` | JSDoc with `@description`, field docs |
| Classes and methods | `export class` | JSDoc with class-level and method-level docs |
| API endpoints | `src/api/routes/*.ts` | OpenAPI-style route docs |
| MCP tools | `src/mcp/tools/*.ts` | Tool description + param docs |
| CLI commands | `src/cli/*.ts` | Command help text + examples |
| Zod schemas | `src/schemas/*.ts` | Schema description + field docs |

Build the inventory matrix:

| Module | Public Exports | Documented | Undocumented | Coverage % |
|--------|---------------|------------|--------------|------------|
| `core/store` | N | N | N | N% |
| `core/parser` | N | N | N | N% |
| ... | ... | ... | ... | ... |

### Step 2: Detect — Find Documentation Gaps and Staleness

**Undocumented entities:**

```
Tool: mcp__mcp-graph__code_intelligence (action: "search", query: "public functions without JSDoc")
```

Classify gaps:

| Gap Type | Detection Method | Priority |
|----------|-----------------|----------|
| Public function without JSDoc | Code Intelligence: no `/** */` before export | High |
| Interface without field docs | No `/** */` on interface fields | Medium |
| API route without description | Router handler missing doc comment | Critical |
| MCP tool without param docs | Tool definition missing descriptions | Critical |
| Schema without descriptions | Zod schema fields without `.describe()` | Medium |

**Stale documentation:**

Detect docs that no longer match code:
- Function signature changed but JSDoc `@param` not updated
- API endpoint changed response shape but docs show old format
- Module moved/renamed but references still point to old path
- README sections that reference non-existent files or functions

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

### Step 3: Generate — Create Documentation

**3a. JSDoc Generation:**

For each undocumented public function, generate JSDoc:

```typescript
/**
 * Brief description of what the function does.
 *
 * @param paramName - Description of the parameter
 * @returns Description of the return value
 * @throws {ErrorType} When the error condition occurs
 *
 * @example
 * ```typescript
 * const result = functionName(input);
 * ```
 */
```

Generation rules:
- Infer purpose from function name, parameters, and return type
- Analyze the function body to determine edge cases for `@throws`
- Include at least one `@example` for complex functions
- Use the project's typed error classes in `@throws` (not generic `Error`)

**3b. API Endpoint Documentation:**

For each undocumented API route, generate:

| Field | Content |
|-------|---------|
| Method | GET/POST/PUT/DELETE |
| Path | `/api/v1/resource` |
| Description | What the endpoint does |
| Request body | Zod schema reference or JSON shape |
| Response | Success and error response shapes |
| Status codes | 200, 400, 404, 500 with descriptions |
| Example | curl or fetch example |

```
Tool: mcp__mcp-graph__search (query: "router.get router.post router.put router.delete")
```

**3c. Architecture Documentation:**

For undocumented modules, generate module-level docs:

```
Tool: mcp__mcp-graph__code_intelligence (action: "search", query: "module dependencies and relationships")
```

Include:
- Module purpose and responsibility
- Key exported symbols and their roles
- Dependencies (what this module imports)
- Dependents (what imports this module)
- Data flow diagram (text-based)

**3d. MCP Tool Documentation:**

For each undocumented MCP tool:
```
Tool: mcp__mcp-graph__search (query: "tool definition and parameters")
```

Generate:
- Tool name and description
- Parameter table (name, type, required, description)
- Return value description
- Usage example
- Related tools

### Step 4: Validate — Accuracy Check

Verify generated documentation is accurate:

For JSDoc:
- Ensure `@param` names match actual parameter names
- Ensure `@returns` type matches actual return type
- Ensure `@throws` errors are actually thrown in the function body
- Ensure `@example` code compiles (type-check)

For API docs:
- Ensure request/response shapes match Zod schemas
- Ensure status codes match actual error handling
- Ensure paths match registered routes

```
Tool: mcp__mcp-graph__analyze (mode: "done_integrity")
```

If validation finds inaccuracies, fix before committing.

### Step 5: Sync — Update Cross-References

Ensure all documentation references are consistent:

```
Tool: mcp__mcp-graph__search (query: "docs/reference docs/architecture")
```

Sync checklist:

| Reference | Source of Truth | Update If |
|-----------|----------------|-----------|
| MCP Tools Reference | `src/mcp/tools/*.ts` | New tools added or params changed |
| REST API Reference | `src/api/routes/*.ts` | New routes or response changes |
| Architecture docs | `src/core/**/*.ts` | Module structure changed |
| CLAUDE.md capabilities | All modules | New capabilities added |
| README quickstart | `src/cli/index.ts` | CLI commands changed |

```
Tool: mcp__mcp-graph__export (format: "mermaid")
```

Update architecture diagrams if module relationships changed.

### Step 6: Record Documentation Results

Save the documentation generation report:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Documentation Generation Report — <date>"
  content: "<inventory summary, gaps found, docs generated, validation results, sync status>"
  tags: ["documentation", "auto-generated", "jsdoc", "api-docs"]
```

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

For persistent documentation gaps that require human judgment, create tasks:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  type: "task"
  title: "Docs: <module> — document <N> public APIs"
  description: "Documentation gaps detected by autonomous generator.\n\nUndocumented:\n- <list of functions/routes>\n\nAcceptance Criteria:\n- [ ] All public exports have JSDoc\n- [ ] API routes documented with request/response shapes\n- [ ] Examples included for complex functions"
  tags: ["documentation", "auto-generated"]
```

## Output Format

```
Phase: AUTONOMOUS DOCUMENTATION GENERATION
Loop: Scan -> Detect -> Generate -> Validate -> Sync

Scan:
  Modules scanned: <N>
  Public exports: <N> (functions: <N>, interfaces: <N>, classes: <N>)
  API routes: <N>
  MCP tools: <N>

Detect:
  Undocumented: <N> (critical: <N>, high: <N>, medium: <N>)
  Stale docs: <N> (signature mismatch: <N>, path changed: <N>)
  Documentation coverage: <N>%

Generate:
  JSDoc comments: <N> generated
  API docs: <N> routes documented
  Architecture docs: <N> modules documented
  MCP tool docs: <N> tools documented

Validate:
  Accuracy: <N>/<N> generated docs verified correct
  Fixes needed: <N>

Sync:
  References updated: <N>
  Cross-reference consistency: <passed/N issues>

Tasks created: <N> for gaps requiring human judgment
Saved to memory: "Documentation Generation Report — <date>"
```

## Anti-Patterns

- Do NOT confuse this with `graph-docs` (manual docs workflow) — this is autonomous generation
- Do NOT generate documentation for internal/private functions — focus on public API surface
- Do NOT create README files unless explicitly requested — this generates inline docs and reference docs
- Do NOT generate speculative documentation — only document what the code actually does
- Do NOT skip validation — inaccurate docs are worse than no docs (they mislead)
- Do NOT overwrite hand-written documentation — only fill gaps and update stale sections
- Do NOT generate more than 50 JSDoc blocks per cycle — review quality before quantity
