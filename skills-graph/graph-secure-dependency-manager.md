---
name: graph-secure-dependency-manager
description: Secure dependency updates with SBOM generation, license compliance auditing, and automated safety-checked upgrades
triggers:
  - graph-secure-dependency-manager
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-secure-dependency-manager

Secure dependency management that audits all project dependencies, generates a Software Bill of Materials (SBOM) in CycloneDX format, checks license compliance against project policy, and performs automated updates with safety checks including build verification and test regression detection. This skill operates proactively — monitoring for outdated dependencies, license violations, and supply chain risks on a continuous basis.

## When to Use

- Automatically on a weekly cadence during LISTENING phase to detect outdated or vulnerable dependencies
- Before PLAN phase to ensure dependency landscape is clean before sprint work
- When adding a new dependency — triggered by changes to `package.json`
- Before DEPLOY phase as a supply chain integrity gate
- When the user says "update dependencies", "SBOM", "license check", "dependency audit", or "supply chain"
- Proactively when a dependency has been outdated for more than 30 days without action

## Mandatory Flow

```
inventory_deps → generate_sbom → license_audit → vulnerability_cross_check → update_candidates → safety_check_updates → apply_updates → verify_build_tests → create_tracking_nodes → write_memory
```

## Workflow

### Step 1: Dependency Inventory and Classification

Build a complete inventory of all direct and transitive dependencies:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "progress"
```

Classify each dependency:

| Classification | Criteria | Risk Level |
|---|---|---|
| Direct production | Listed in `dependencies` | High — runtime impact |
| Direct dev | Listed in `devDependencies` | Medium — build/test impact |
| Transitive production | Required by a production dep | High — hidden runtime risk |
| Transitive dev | Required by a dev dep | Low — build-only impact |
| Peer | Listed in `peerDependencies` | Medium — compatibility risk |
| Optional | Listed in `optionalDependencies` | Low — graceful degradation |

Count totals and identify the dependency tree depth:

```bash
npm ls --all --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(JSON.stringify({direct: Object.keys(d.dependencies||{}).length}))"
```

Search for previous dependency audits in knowledge:

```
Tool: mcp__mcp-graph__search
Params:
  query: "dependency audit sbom supply chain"
  scope: "memories"
```

### Step 2: SBOM Generation (CycloneDX Format)

Generate a Software Bill of Materials following CycloneDX 1.5 specification:

SBOM must include for each component:
- Package name and version (exact, from lockfile)
- Package URL (purl) in `pkg:npm/<scope>/<name>@<version>` format
- License identifier (SPDX format)
- SHA-256 hash of the installed package
- Direct vs transitive classification
- Supplier/author information
- Known vulnerabilities (cross-referenced in Step 4)

```bash
npx @cyclonedx/cyclonedx-npm --output-file sbom.json --spec-version 1.5
```

If CycloneDX CLI is not available, generate a minimal SBOM manually from `package-lock.json`:
1. Parse the lockfile
2. Extract all resolved packages with versions and integrity hashes
3. Format as CycloneDX JSON
4. Include metadata: tool name, timestamp, component count

Store SBOM as a project artifact and index in knowledge:

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "SBOM — <date>"
  content: "<component count, direct deps, transitive deps, license summary>"
  tags: ["sbom", "dependencies", "supply-chain", "security"]
```

### Step 3: License Compliance Audit

Check all dependencies against the project license policy:

| License Category | Allowed | Examples | Action |
|---|---|---|---|
| Permissive | Yes | MIT, BSD-2-Clause, BSD-3-Clause, ISC, Apache-2.0 | No action needed |
| Weak copyleft | Conditional | LGPL-2.1, LGPL-3.0, MPL-2.0 | Review usage — OK if not modified |
| Strong copyleft | Restricted | GPL-2.0, GPL-3.0, AGPL-3.0 | Block — incompatible with most commercial use |
| No license | Restricted | UNLICENSED, no SPDX identifier | Block — legal risk |
| Custom | Review required | Non-standard license text | Manual review required |
| Multi-license | Conditional | (MIT OR GPL-3.0) | Verify at least one allowed license applies |

For each violation found:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "LICENSE-ISSUE: <package> uses <license>"
  type: "task"
  priority: "high"
  description: "Package <package@version> uses <license> which violates project license policy. Options: 1) Find alternative package with permissive license. 2) Request license exception with legal review. 3) Remove dependency."
  acceptanceCriteria: "1. Package replaced or exception documented\n2. No restricted licenses in dependency tree\n3. SBOM updated"
```

### Step 4: Vulnerability Cross-Check

Cross-reference every dependency against vulnerability databases:

```bash
npm audit --json
```

Enrich findings with data from previous security scans:

```
Tool: mcp__mcp-graph__search
Params:
  query: "CVE vulnerability security scan"
  scope: "knowledge"
```

For each vulnerability, record:
- CVE ID and CVSS score
- Affected version range
- Fixed version (if available)
- Whether the vulnerable code path is actually reachable in this project
- Exploitability assessment (public exploit, PoC, theoretical)

Reachability analysis using code intelligence:

```
Tool: mcp__mcp-graph__code_intelligence
Params:
  action: "search"
  query: "<vulnerable-package-name>"
```

Mark unreachable vulnerabilities as lower priority but still track them — transitive usage patterns can change.

### Step 5: Identify Update Candidates

Determine which dependencies can be safely updated:

| Update Type | Version Change | Risk | Strategy |
|---|---|---|---|
| Patch | x.y.Z → x.y.Z+1 | Low | Auto-update with test verification |
| Minor | x.Y.z → x.Y+1.0 | Medium | Auto-update with build + test verification |
| Major | X.y.z → X+1.0.0 | High | Create task node, manual review required |
| Security patch | Any → fixed version | Critical | Auto-update immediately, verify after |

Generate the candidate list:

```bash
npm outdated --json
```

Prioritize updates:
1. Security patches (any severity) — immediate
2. Packages with known CVEs — within 24h
3. Major version behind — within sprint
4. Minor version behind — batch with next update cycle
5. Patch version behind — auto-update

### Step 6: Safety-Checked Update Execution

For each update candidate (patch and minor), execute with safety checks:

1. **Pre-update snapshot**: Record current lockfile hash and test results
2. **Apply update**: `npm update <package>` (or `npm install <package>@<version>` for targeted)
3. **Build verification**: `npm run build` must succeed
4. **Type check**: `npm run typecheck` must report zero errors
5. **Test suite**: `npm test` must pass with zero failures
6. **Regression detection**: Compare test output with pre-update baseline
7. **Bundle size check**: Verify no significant size increase (>10% threshold)

If any check fails:
1. Revert: `git checkout -- package.json package-lock.json && npm install`
2. Log the failure reason
3. Create a task node for manual resolution

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "DEP-UPDATE: <package> <old-version> → <new-version>"
  type: "task"
  priority: "medium"
  description: "Automated update of <package> failed safety checks. Failure: <reason>. Manual intervention required."
  acceptanceCriteria: "1. Package updated successfully\n2. Build passes\n3. All tests pass\n4. No bundle size regression"
```

### Step 7: Verify Build and Test Integrity

After all updates are applied, run the full verification suite:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "done_integrity"
```

Verification checklist:
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` reports zero errors
- [ ] `npm test` passes with zero failures
- [ ] No new lint violations
- [ ] Lockfile integrity hash matches expected
- [ ] SBOM regenerated with updated versions

### Step 8: Create Tracking Nodes for Major Updates

For each major version update that requires manual intervention:

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "DEP-MAJOR: Upgrade <package> to v<major>"
  type: "task"
  priority: "medium"
  description: "Major version upgrade required. Breaking changes: <list from changelog>. Migration guide: <url>. Current: <version>. Target: <version>."
  acceptanceCriteria: "1. Package upgraded to target version\n2. All breaking changes addressed\n3. Build and tests pass\n4. SBOM updated"
```

### Step 9: Persist Results to Memory

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Dependency Audit — <date>"
  content: "<total deps, outdated count, vulnerability count, license violations, updates applied, updates failed, SBOM status>"
  tags: ["dependencies", "sbom", "license", "supply-chain", "security", "audit"]
```

## Output Format

```
Phase: SECURE DEPENDENCY MANAGEMENT
Total Dependencies: N direct, N transitive (N total)

SBOM Status: Generated (CycloneDX 1.5)
  Components: N
  Artifact: sbom.json

License Compliance:
  Permissive: N packages (N%)
  Weak Copyleft: N packages (reviewed)
  Violations: N packages (N blocked)

Vulnerability Status:
  Critical: N (N reachable)
  High: N (N reachable)
  Moderate: N
  Low: N

Updates Applied:
  Security Patches: N
  Patch Updates: N
  Minor Updates: N
  Failed Updates: N (task nodes created)

Major Updates Pending: N (task nodes created)
Build Verification: PASS/FAIL
Test Regression: NONE / N failures detected
Overall Supply Chain Grade: A-F

Saved to memory: "Dependency Audit — <date>"
```

## Anti-Patterns

- Do NOT update all dependencies at once — batch by risk level and verify incrementally
- Do NOT ignore license compliance — a single GPL dependency can have legal implications for the entire project
- Do NOT skip the build/test verification after updates — silent regressions from dependency changes are common
- Do NOT treat transitive vulnerabilities as "not our problem" — they execute in your process
- Do NOT generate SBOM only once — regenerate after every dependency change to maintain accuracy
- Do NOT auto-update major versions — breaking changes require manual review and migration planning
- Do NOT ignore packages with no license — "no license" means "all rights reserved" by default, which is the most restrictive
