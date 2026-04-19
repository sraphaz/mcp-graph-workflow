# Sandbox Build — Functional Architecture & Constraints

**Wave 12 — Local CI/CD Isolation** | Deterministic Pre-Push Validation

---

## Executive Summary

**Sandbox Build** is a 4-layer architecture for deterministic local validation before push:
1. **Input Layer** — Configuration + stack auto-detection
2. **Isolation Layer** — Docker → Podman → Process fallback chain
3. **Execution Layer** — Transactional build/test with timeout enforcement
4. **Output Layer** — Test result parsing + graph integration

**Key Constraints:**
- Zero cross-test pollution (isolation guarantee)
- Hard timeout kill on TIMEOUT (no graceful shutdown)
- Fingerprint-based cache invalidation on dependency changes
- Multi-format test result fidelity (Surefire/JUnit/Jest/Go-test)
- Cross-platform support (Linux/Mac/Windows with Docker/Podman/Process)

---

## Architecture Layers

### Layer 0: Input (SandboxBuilder Configuration)

**Responsibility:** Validate & normalize input contract.

```
┌─────────────────────────────────────┐
│   SandboxBuilder Input              │
├─────────────────────────────────────┤
│ projectDir         (path)           │
│ isolatedDir        (temp path)      │
│ stack              (auto-detect)    │
│ isolation          (docker→fallback)│
│ timeout            (ms, default 5m) │
│ profile            (ci-mirror|fast) │
│ cacheDir           (optional)       │
└─────────────────────────────────────┘
              │
              ▼
      ┌──────────────────┐
      │ Validate Schema  │
      │ (Zod v4)        │
      └──────────────────┘
              │
              ▼
      ┌──────────────────┐
      │ Stack Detection  │
      │ (pom.xml/go.mod) │
      └──────────────────┘
              │
              ▼
   BuilderConfig (normalized)
```

**Zod Schema:**
```typescript
BuilderConfigSchema = {
  projectDir:    string          // required, must exist
  isolatedDir:   string          // required, writable
  stack:         enum[...]       // "maven" | "gradle" | "npm" | "go" | "pip" | "auto"
  command:       string          // build/test command
  timeout:       number          // 300000ms default
  isolation:     enum[...]       // "docker" | "podman" | "process" | "auto"
  profile:       enum[...]       // "ci-mirror" | "fast" | "full"
  image?:        string          // Docker image (optional)
  cacheDir?:     string          // Cache location (optional)
}
```

### Layer 1: Isolation (Execution Environment Resolution)

**Responsibility:** Guarantee environment isolation + implement fallback chain.

```
┌────────────────────────────────────────────┐
│   Isolation Resolution                     │
├────────────────────────────────────────────┤
│ Check availability                         │
│  ├─ docker --version                       │
│  ├─ podman --version                       │
│  └─ process (always available)             │
│                                            │
│ Apply fallback chain (config-driven)       │
│  1. Try preferred (if specified)           │
│  2. Try primary fallback                   │
│  3. Try secondary fallback                 │
│  4. Use final fallback (process)           │
│                                            │
│ Prepare execution env                      │
│  ├─ Copy project to isolatedDir            │
│  ├─ Mount points (if containerized)        │
│  └─ Set env vars + credentials             │
└────────────────────────────────────────────┘
```

**Fallback Chain Semantics:**

| Scenario | Chain | Rationale |
|----------|-------|-----------|
| `profile=ci-mirror` | Docker → Podman → Process | Closest CI reproduction |
| `profile=fast` | Process only | Dev iteration speed |
| `profile=full` | Docker (clean) → Podman → Process | CI bug reproduction |
| `isolation=auto` | Docker → Podman → Process | Default cascade |
| `isolation=process` | Process only | Forced lightweight mode |

**Constraints:**

1. **No Cross-Test Pollution**
   - Each execution uses isolated directory tree
   - No shared state in `/tmp` or `node_modules`
   - Cleanup on failure prevents test bleed

2. **Timeout Enforcement**
   - Hard kill at `timeout` ms (no graceful shutdown)
   - Kill entire process tree (not just parent)
   - Record `timeout=true` in result

3. **Environment Sealing**
   - `process` mode: Copy project, execute in temp dir, clean after
   - `docker`/`podman` mode: Mount read-only source, writable output dir
   - No write to original `projectDir`

### Layer 2: Cache (Fingerprint-Based Invalidation)

**Responsibility:** Avoid redundant builds via content hash matching.

```
┌─────────────────────────────────────┐
│   Fingerprint Generation            │
├─────────────────────────────────────┤
│ Inputs:                             │
│  ├─ package.json (or pom.xml, etc)  │
│  ├─ lock files (package-lock.json)  │
│  ├─ build config (pom.xml, go.mod)  │
│  ├─ Node.js/Java/Python version     │
│  └─ Build command + profile         │
│                                     │
│ Hash = SHA256(JSON.stringify(inputs))
│                                     │
│ Cache Lookup                        │
│  ├─ If hash exists in cache         │
│  │  └─ return cached result         │
│  └─ Else                            │
│     └─ execute + store              │
└─────────────────────────────────────┘
```

**Invalidation Triggers:**

| Trigger | Detection | Action |
|---------|-----------|--------|
| Dependency change | package.json mtime | Rehash, invalidate if differ |
| Lock file change | package-lock.json diff | Full rebuild |
| Version mismatch | node --version != cached | Invalidate |
| Profile change | ci-mirror → fast | New cache entry |
| Command change | custom command | New cache entry |

**Cache Lifecycle:**

- **Directory:** `workflow-graph/sandbox-cache/` (gitignored)
- **Format:** `${hash}.json` (SHA256 hex)
- **TTL:** 30 days (optional, for cleanup)
- **Eviction:** Manual via `sandbox clean` or environment auto-prune

### Layer 3: Execution (BuilderExecutor)

**Responsibility:** Execute build/test with isolation, timeout, result capture.

```
┌───────────────────────────────────────────────┐
│   BuilderExecutor.execute(config)             │
├───────────────────────────────────────────────┤
│                                               │
│  1. Validate config + normalize               │
│  2. Generate fingerprint                      │
│  3. Check cache                               │
│     ├─ if hit: return cached result           │
│     └─ if miss: continue                      │
│  4. Resolve execution mode (fallback chain)   │
│  5. Setup isolated directory                  │
│  6. Spawn executor process with timeout       │
│     ├─ Monitor stderr/stdout                  │
│     ├─ Enforce timeout (kill on breach)       │
│     └─ Capture exit code                      │
│  7. Store result in cache                     │
│  8. Clean isolated directory                  │
│  9. Return BuilderResult                      │
│                                               │
└───────────────────────────────────────────────┘
```

**Execution Modes:**

**Docker Mode:**
- Pull/verify image (fail-safe: tag mismatch aborts)
- Run container: `docker run --rm -v src:/project:ro -v out:/output image npm test`
- Timeout: Kill container via `docker kill`
- Failure: Retain stdout/stderr for debugging

**Podman Mode:**
- Identical Docker semantics
- Use `podman` binary instead of `docker`
- Rootless mode safe (no privilege escalation)

**Process Mode:**
- `cp -r projectDir isolatedDir`
- `cd isolatedDir && npm test` (or mvn, go test, etc.)
- Timeout: Kill entire process tree via `process.kill(-pid)`
- Cleanup: `rm -rf isolatedDir` regardless of outcome

**Timeout Handling:**

```typescript
// Hard kill, no graceful shutdown
setTimeout(() => {
  if (process.kill(-pid)) {  // Kill entire process group
    result.timeout = true
    result.status = 'timeout'
  }
}, timeout)
```

### Layer 4: Output (SandboxReport & Result Integration)

**Responsibility:** Parse test results, integrate with graph, block on failure.

```
┌──────────────────────────────────────┐
│   Test Result Parsing                │
├──────────────────────────────────────┤
│ Detect format                        │
│  ├─ Surefire XML (Maven)             │
│  ├─ JUnit XML (Gradle)               │
│  ├─ Jest JSON (npm)                  │
│  └─ Go test output (Go)              │
│                                      │
│ Extract metrics                      │
│  ├─ total / passed / failed / skipped│
│  ├─ test names (file::test)          │
│  ├─ duration per test                │
│  └─ error stack traces               │
│                                      │
│ Generate report                      │
│  ├─ SandboxReport (structured)       │
│  └─ Evidence (test files, logs)      │
└──────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│   Graph Integration (optional)        │
├──────────────────────────────────────┤
│ If updateGraph=true:                 │
│  ├─ Fetch node from graph            │
│  ├─ Attach testFiles + evidence      │
│  ├─ Update status                    │
│  │  ├─ blocked (if failed)           │
│  │  └─ in_progress (if success)      │
│  └─ Store rationale                  │
│                                      │
│ If validateGraphConstraints:         │
│  ├─ Check constitution rules         │
│  ├─ Run qualityGates                 │
│  └─ Return gate result               │
└──────────────────────────────────────┘
```

**Test Format Parsers:**

| Format | File Path | Extraction |
|--------|-----------|-----------|
| Surefire | `target/surefire-reports/*.xml` | `<testsuite>` → count tests |
| JUnit | `target/surefire-reports/*.xml` | Same as Surefire |
| Jest | `coverage/report.json` | `.testResults[]` → metrics |
| Go-test | stdout (stderr fallback) | `ok\|FAIL` + `coverage: X%` |

**Graph Integration:**

```typescript
// If sandbox fails and updateGraph=true
await graph.updateNode(nodeId, {
  status: 'blocked',
  blockerReason: `Sandbox test failure: ${failedTests.length} tests failed`,
  testFiles: result.testReportPath,
  metadata: {
    sandboxFailure: {
      timestamp: result.timestamp,
      failedTests,
      exitCode: result.exitCode,
    }
  }
})

// If sand box succeeds
await graph.updateNode(nodeId, {
  status: 'in_progress',  // or advance toward done
  metadata: {
    sandboxSuccess: {
      testsPassed: result.totalTests - result.failedTests,
      testsDuration: result.durationMs,
      executionMode: result.executionMode,
      cacheHit: result.cacheHit,
    }
  }
})
```

---

## Key Constraints

### 1. Isolation Guarantee

**Statement:** No test output pollutes subsequent test runs.

**Implementation:**
- Each execution in fresh `isolatedDir` (temp dir)
- Source mounted read-only in containerized modes
- Write to output directory only
- Cleanup on process exit (success or failure)
- Verify no shared temp files across runs

**Test Case:**
```gherkin
Given build A and build B with same source
When both run sequentially
Then build B output is clean (no artifacts from A)
```

### 2. Timeout Enforcement

**Statement:** Runaway builds are killed hard at configured timeout.

**Implementation:**
- Timeout is absolute, enforced by parent process
- No graceful shutdown signal sent
- Kill entire process tree (SIGKILL group)
- Record timeout event in result
- Return failed status with clear message

**Test Case:**
```gherkin
Given timeout=5000ms and build sleeps 10s
When build executes
Then execution terminates at ~5000ms
And result.status = 'timeout'
And no lingering processes remain
```

### 3. Cache Invalidation

**Statement:** Cache is invalidated if inputs change, rewilded if identical.

**Implementation:**
- Fingerprint = SHA256(package.json + lock files + versions)
- Detect changes via file mtime or content diff
- Mismatch → rehash and compare
- Cache lookup is deterministic (same inputs → same hash)
- Stale cache detected on profile/command change

**Test Case:**
```gherkin
Given build runs and succeeds (cached)
When package.json unchanged and profile unchanged
Then second run returns cached result
And result.cacheHit = true

Given same scenario but package.json updated
When build runs
Then cache invalidated
And result.cacheHit = false
```

### 4. Test Result Fidelity

**Statement:** Parsed results match source files exactly (no data loss).

**Implementation:**
- Parser validates XML structure before extraction
- Graceful fallback to raw output if parse fails
- Preserve original test stack traces
- Store full result file (e.g., `surefire-reports/`)
- Diff assert against known fixtures

**Test Case:**
```gherkin
Given Maven test with 5 passed, 2 failed
When parser extracts from surefire XML
Then parsed.passed = 5
And parsed.failed = 2
And parsed.tests[].stackTrace contains line numbers
```

### 5. Cross-Platform Support

**Statement:** Execution works on Linux, Mac, Windows with Docker/Podman/Process.

**Implementation:**
- Path resolution via `path.resolve()` (OS-agnostic)
- Docker/Podman client installed (auto-detect)
- Process fallback uses platform-native shell
- Test on all 3 platforms in CI
- Record `executionMode` in result

**Test Case:**
```gherkin
Given Windows machine without Docker
When sandbox executes with isolation=auto
Then fallback chain resolves to Process mode
And build completes successfully
```

---

## API Contract (Zod Schemas)

### BuilderConfig (Input)

```typescript
export const BuilderConfigSchema = z.object({
  projectDir: z.string()
    .describe("Absolute path to project root"),
  
  isolatedDir: z.string()
    .describe("Absolute path to temp/isolated execution dir"),
  
  stack: z.enum(["maven", "gradle", "npm", "go", "pip", "auto"])
    .default("auto")
    .describe("Build system auto-detected if 'auto'"),
  
  command: z.string()
    .describe("Build command (e.g., 'npm test', 'mvn test')"),
  
  timeout: z.number().int().positive()
    .default(300000)
    .describe("Timeout in milliseconds (hard kill)"),
  
  isolation: z.enum(["docker", "podman", "process", "auto"])
    .default("auto")
    .describe("Execution isolation mode with fallback chain"),
  
  profile: z.enum(["ci-mirror", "fast", "full"])
    .default("fast")
    .describe("Profile: ci-mirror (Docker), fast (Process), full (Docker clean)"),
  
  image: z.string().optional()
    .describe("Docker/Podman image (e.g., 'maven:3.9.0')"),
  
  cacheDir: z.string().optional()
    .describe("Custom cache directory (defaults to .cache/sandbox-builder)"),
});

export type BuilderConfig = z.infer<typeof BuilderConfigSchema>;
```

### BuilderResult (Output)

```typescript
export const BuilderResultSchema = z.object({
  success: z.boolean()
    .describe("true if build/test passed, false otherwise"),
  
  status: z.enum(["success", "failure", "timeout", "error"])
    .describe("Execution outcome"),
  
  executionMode: z.enum(["docker", "podman", "process"])
    .describe("Actual mode used (after fallback resolution)"),
  
  command: z.string()
    .describe("Executed command"),
  
  profile: z.enum(["ci-mirror", "fast", "full"])
    .describe("Profile used"),
  
  durationMs: z.number()
    .describe("Total execution time"),
  
  exitCode: z.number().optional()
    .describe("Process exit code (0 = success)"),
  
  output: z.string()
    .describe("Combined stdout/stderr"),
  
  stderr: z.string().optional()
    .describe("Separate stderr (if captured)"),
  
  timestamp: z.string().datetime()
    .describe("ISO 8601 timestamp"),
  
  isolatedDir: z.string()
    .describe("Isolated directory used"),
  
  cacheKey: z.string()
    .describe("SHA256 fingerprint hash"),
  
  cacheHit: z.boolean()
    .describe("true if result returned from cache"),
  
  fallbackChain: z.array(z.enum(["docker", "podman", "process"]))
    .optional()
    .describe("Modes attempted before success"),
});

export type BuilderResult = z.infer<typeof BuilderResultSchema>;
```

### SandboxReport (Graph Integration)

```typescript
export const SandboxReportSchema = z.object({
  nodeId: z.string()
    .describe("Graph node ID being validated"),
  
  sandboxResult: BuilderResultSchema
    .describe("BuilderResult from execution"),
  
  testsParsed: z.object({
    format: z.enum(["surefire", "junit", "jest", "go-test", "unknown"]),
    totalTests: z.number(),
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    failedTests: z.array(z.object({
      name: z.string(),
      file: z.string(),
      stackTrace: z.string(),
    })),
  }).optional()
    .describe("Parsed test results"),
  
  testReportPath: z.string().optional()
    .describe("Path to original test report file"),
  
  graphUpdate: z.object({
    nodeId: z.string(),
    status: z.enum(["blocked", "in_progress", "done"]),
    rationale: z.string(),
  }).optional()
    .describe("Graph update applied (if updateGraph=true)"),
  
  qualityGates: z.array(z.object({
    name: z.string(),
    passed: z.boolean(),
    reason: z.string().optional(),
  })).optional()
    .describe("Quality gate results"),
});

export type SandboxReport = z.infer<typeof SandboxReportSchema>;
```

### StackDetector Result

```typescript
export const StackDetectionResultSchema = z.object({
  stack: z.enum(["maven", "gradle", "npm", "go", "pip", "unknown"]),
  confidence: z.number().min(0).max(1),
  indicators: z.array(z.object({
    file: z.string(),
    detected: z.boolean(),
  })),
});

export type StackDetectionResult = z.infer<typeof StackDetectionResultSchema>;
```

---

## Lifecycle Integration

### Pre-Push Validation Flow

```
┌─────────────────────────────────────────────────────┐
│  start_task(agentId, autoStart=true)                │
└─────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  sandbox(action='resolve')                          │
│  → Resolve dependencies with cache                  │
│  → Block if unresolvable                            │
└─────────────────────────────────────────────────────┘
              │
              ▼
      [TDD Red-Green-Refactor]
      ├─ Write test
      ├─ Run test (process mode, fast)
      └─ Implement
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  sandbox(action='test', profile='ci-mirror')        │
│  → Run in isolated Docker container                 │
│  → Enforce timeout                                  │
│  → Parse results                                    │
└─────────────────────────────────────────────────────┘
              │
              ▼ (if all pass)
┌─────────────────────────────────────────────────────┐
│  sandbox(action='build', profile='ci-mirror')       │
│  → Compile in isolated Docker container             │
│  → Cache result                                     │
└─────────────────────────────────────────────────────┘
              │
              ▼ (if success)
┌─────────────────────────────────────────────────────┐
│  finish_task(nodeId, qualityGates=[...])            │
│  → Run security_scan, code_quality                  │
│  → Run constitution checks                          │
│  → Only then mark done                              │
└─────────────────────────────────────────────────────┘
              │
              ▼ (all gates pass)
      [Safe to git push]
```

---

## Error Handling & Resilience

### Error Classes (Typed)

```typescript
export class SandboxTimeoutError extends Error {
  constructor(public durationMs: number, public timeout: number) {
    super(`Build timeout: ${durationMs}ms > ${timeout}ms`)
  }
}

export class SandboxIsolationError extends Error {
  constructor(public reason: string) {
    super(`Isolation setup failed: ${reason}`)
  }
}

export class SandboxParseError extends Error {
  constructor(public format: string, public filePath: string) {
    super(`Failed to parse ${format} report at ${filePath}`)
  }
}
```

### Recovery Strategy

| Error | Detection | Recovery |
|-------|-----------|----------|
| Timeout | `durationMs > timeout` | Fail with `status=timeout`, suggest cache clear |
| Docker unavailable | `docker --version` fails | Fallback to Podman |
| Podman unavailable | `podman --version` fails | Fallback to Process |
| Isolated dir not writable | `mkdir` fails | Error immediately, suggest permissions |
| Test parser fails | XML parse error | Return raw output, mark `parseError=true` |
| Graph update fails | Network/DB error | Log but don't fail build validation |

---

## Testing Strategy

### Unit Tests (Per Layer)

**Layer 0 (Input):**
- Test schema validation (valid/invalid inputs)
- Test stack auto-detection (all file types)

**Layer 1 (Isolation):**
- Test fallback resolution (all chain permutations)
- Test directory isolation (no pollution)
- Test timeout enforcement (hard kill)

**Layer 2 (Cache):**
- Test fingerprint consistency
- Test cache hit/miss behavior
- Test invalidation on change

**Layer 3 (Execution):**
- Test Maven/npm/Go/Python builds
- Test cross-platform support
- Test result capture

**Layer 4 (Output):**
- Test Surefire parser (pass/fail/skip)
- Test Jest parser (same)
- Test graph integration

### Integration Tests

- Full pipeline: `resolve` → `build` → `test` → `report`
- Fallback chain: Docker unavailable → Podman → Process
- Cache behavior: Hit on identical inputs, invalidate on change
- Graph integration: Update node on success/failure

### E2E Tests (Browser/Real Projects)

- Real Maven project with test failures
- Real npm/TypeScript project
- Go module with test coverage
- Timeout enforcement on sleep command
- Cleanup verification (no temp dirs leaked)

---

## Implementation Checklist

- [ ] **Layer 0:** BuilderConfig schema + validation
- [ ] **Layer 0:** Stack detector (pom.xml, package.json, go.mod, requirements.txt)
- [ ] **Layer 1:** FallbackResolver (docker/podman/process availability check)
- [ ] **Layer 1:** Directory isolation (copy project, execute in temp, cleanup)
- [ ] **Layer 2:** Fingerprint generator (SHA256 input hash)
- [ ] **Layer 2:** SandboxCache (file-based cache with get/put/invalidate)
- [ ] **Layer 3:** BuilderExecutor (execute with timeout + fallback)
- [ ] **Layer 3:** Timeout enforcement (hard kill on breach)
- [ ] **Layer 4:** Test parsers (Surefire, JUnit, Jest, Go-test)
- [ ] **Layer 4:** SandboxReport generator
- [ ] **Layer 4:** Graph integration (update node on failure/success)
- [ ] **Integration:** Pre-push validation workflow
- [ ] **Tests:** Unit + integration + E2E
- [ ] **Docs:** Architecture guide (this file)

---

## References

- [Wave-12 PRD](../prd/waves/wave-12-sandbox-build-local-ci-cd-isolation.md)
- [BuilderExecutor Source](../../src/core/sandbox/builder-executor.ts)
- [SandboxCache Source](../../src/core/sandbox/sandbox-cache.ts)
- [Test Parsers](../../src/core/sandbox/)
- [Constitution & Quality Gates](./LIFECYCLE.md)
