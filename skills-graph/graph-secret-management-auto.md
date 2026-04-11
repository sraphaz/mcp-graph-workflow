---
name: graph-secret-management-auto
description: Local vault with automatic secret rotation, leak detection, and exposure remediation for mcp-graph workflows
triggers:
  - graph-secret-management-auto
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-secret-management-auto

Local secret vault with automatic rotation, leak detection, and exposure remediation. Continuously monitors the codebase for exposed secrets, manages a local encrypted vault for API keys and tokens, rotates secrets on schedule or after detected exposure, and creates remediation tasks when leaks are found. This skill is fully autonomous — it proactively scans on every commit-like event and self-heals by rotating compromised credentials.

## When to Use

- Automatically before every REVIEW and DEPLOY phase gate as a mandatory secret scan
- Proactively on every file change that touches configuration, environment, or credential files
- On a daily cadence during LISTENING phase to detect secrets that may have been committed
- When a new API key, token, or credential is introduced to the project
- When the user says "check secrets", "rotate keys", "vault", "credential scan", or "secret leak"
- Immediately when git history analysis reveals a previously committed secret (even if since removed)

## Mandatory Flow

```
scan_codebase → scan_git_history → classify_findings → check_vault_health → rotate_compromised → update_references → verify_no_exposure → create_remediation_nodes → write_memory
```

## Workflow

### Step 1: Codebase Secret Scanning

Scan all source files for exposed secrets using pattern matching and entropy analysis:

```
Tool: mcp__mcp-graph__code_intelligence
Params:
  action: "search"
  query: "password secret token key credential"
```

Apply detection patterns across the entire source tree:

| Pattern Category | Regex Pattern | Severity | False Positive Mitigation |
|---|---|---|---|
| AWS Access Key | `AKIA[0-9A-Z]{16}` | Critical | Validate format + length |
| AWS Secret Key | `[0-9a-zA-Z/+=]{40}` near "aws" | Critical | Context-aware: require nearby "aws" keyword |
| Generic API Key | `[a-zA-Z0-9_-]{32,}` in assignment | High | Check variable name contains key/token/secret |
| Bearer Token | `Bearer\s+[A-Za-z0-9\-._~+/]+=*` | High | Skip test fixtures with mock prefix |
| Private Key | `-----BEGIN.*PRIVATE KEY-----` | Critical | No false positives — always real |
| Password Assignment | `password\s*[:=]\s*["'][^"']+["']` | High | Skip if value is placeholder/example |
| Connection String | `(mysql|postgres|mongodb)://[^@]+@` | Critical | Contains embedded credentials |
| GitHub Token | `gh[pousr]_[A-Za-z0-9_]{36,}` | Critical | Validate prefix format |
| Slack Token | `xox[baprs]-[0-9a-zA-Z-]+` | High | Validate prefix format |
| High Entropy String | Shannon entropy > 4.5 in assignment | Medium | Require assignment context |

Exclusion rules to reduce false positives:
- Skip `node_modules/`, `dist/`, `*.lock`, `.git/`
- Skip test files where variable name contains `mock`, `fake`, `stub`, `fixture`
- Skip lines that are clearly comments explaining what a secret looks like
- Skip `.env.example` files that contain placeholder values

```
Tool: mcp__mcp-graph__search
Params:
  query: "api_key token password secret credential"
  scope: "all"
```

### Step 2: Git History Deep Scan

Scan git history for secrets that were committed and later removed — these are still exposed:

```bash
git log --all --diff-filter=D --name-only --pretty=format:"%H %s" -- "*.env" "*.key" "*.pem" "*.p12" "*.pfx" "credentials*" "secrets*"
```

For each deleted sensitive file, check if it contained actual secrets:

```bash
git show <commit>:<filepath> 2>/dev/null | head -5
```

Additionally, scan commit diffs for secret patterns:

```bash
git log --all -p --diff-filter=AM -- "*.ts" "*.js" "*.json" "*.yaml" "*.yml" "*.env" | grep -E "(AKIA|password\s*=|secret\s*[:=]|BEGIN.*KEY)" | head -50
```

| Finding Type | Severity | Remediation |
|---|---|---|
| Secret in current HEAD | Critical | Rotate immediately, remove from code |
| Secret in git history (deleted from HEAD) | High | Rotate, consider git history rewrite |
| Secret in untracked file | Medium | Add to vault, add path to .gitignore |
| Secret in .env not in .gitignore | High | Add to .gitignore, rotate if committed |

### Step 3: Classify and Triage Findings

Classify each finding by risk level:

```
Tool: mcp__mcp-graph__analyze
Params:
  mode: "progress"
```

Risk classification matrix:

| Factor | Weight | Values |
|---|---|---|
| Secret type | 3x | Production credential (3), Test/dev credential (1), Example/placeholder (0) |
| Exposure scope | 2x | Public repo (3), Private repo (2), Local only (1) |
| Rotation status | 2x | Never rotated (3), Rotated > 90 days ago (2), Recently rotated (1) |
| Usage scope | 1x | Used in production (3), Used in CI/CD (2), Used in dev only (1) |

**Composite risk = sum(factor * weight)**. Triage action:

| Risk Score | Action | SLA |
|---|---|---|
| >= 18 | Emergency rotation + incident | Immediate |
| 12-17 | Urgent rotation + remediation node | Within 4 hours |
| 6-11 | Scheduled rotation + remediation node | Within 24 hours |
| 1-5 | Log finding, schedule review | Within 1 sprint |

### Step 4: Vault Health Check

Verify the local secret vault is healthy and properly configured:

Vault health checklist:

| Check | Expected | Action on Failure |
|---|---|---|
| Vault file exists | `~/.mcp-graph/vault.enc` | Create new vault |
| Vault permissions | 0600 (owner read/write only) | Fix permissions |
| Vault encryption | AES-256-GCM | Re-encrypt with correct algorithm |
| Master key accessible | Decryption succeeds | Prompt for key recovery |
| Secret count matches inventory | All tracked secrets present | Re-inventory |
| Last rotation timestamps | None overdue | Trigger rotation |
| Vault backup exists | Recent backup available | Create backup |

```
Tool: mcp__mcp-graph__knowledge_stats
Params: {}
```

Record vault health for audit trail.

### Step 5: Rotate Compromised Secrets

For each secret classified as compromised or overdue for rotation:

1. **Generate new secret**: Use cryptographically secure random generation
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Store new secret in vault**: Encrypt and store with metadata
   - Secret name/identifier
   - Creation timestamp
   - Expiry timestamp (based on rotation policy)
   - Usage locations (files that reference this secret)
   - Previous version (for rollback)

3. **Revoke old secret**: If the secret is for an external service, flag for manual revocation

4. **Update rotation schedule**: Set next rotation date based on policy

Rotation policy by secret type:

| Secret Type | Rotation Period | Auto-Rotate | Manual Step Required |
|---|---|---|---|
| API keys (own services) | 90 days | Yes | No |
| API keys (third-party) | 90 days | No | Regenerate in provider console |
| Database passwords | 90 days | Yes | Update connection configs |
| JWT signing keys | 180 days | Yes | Coordinated deployment |
| Encryption keys | 90 days | Yes | Re-encrypt data (see graph-encryption-manager) |
| SSH keys | 365 days | No | Update authorized_keys |

### Step 6: Update All References

After rotation, update all locations that reference the rotated secret:

```
Tool: mcp__mcp-graph__search
Params:
  query: "<secret-identifier>"
  scope: "all"
```

For each reference found:
1. Replace hardcoded value with environment variable reference
2. Update `.env` file with new value (never commit `.env`)
3. Verify `.env` is in `.gitignore`
4. Update any CI/CD configuration that references the secret

```
Tool: mcp__mcp-graph__code_intelligence
Params:
  action: "impact"
  target: "<file-with-secret>"
  depth: 3
```

Trace all downstream consumers of the secret to ensure nothing breaks after rotation.

### Step 7: Verify Zero Exposure

After remediation, re-scan to verify no secrets remain exposed:

Run the full scan from Step 1 again, targeting only the specific secrets that were found:

```
Tool: mcp__mcp-graph__search
Params:
  query: "<rotated-secret-pattern>"
  scope: "all"
```

Self-healing loop:
- If any exposure persists → return to Step 5 and re-remediate
- Maximum 3 retry loops before escalating to manual intervention
- Each retry is logged with the reason for persistence

Verify git staging area is clean:

```bash
git diff --cached --name-only
```

Ensure no secret will be included in the next commit.

### Step 8: Create Remediation Task Nodes

For findings that require manual intervention (third-party key rotation, git history rewrite):

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "SECRET-ROTATE: <secret-name> exposed in <location>"
  type: "task"
  priority: <mapped from risk score>
  description: "Secret <name> was found exposed in <file:line>. Risk score: <N>. Action required: <specific remediation steps>. Previous rotation: <date or never>."
  acceptanceCriteria: "1. Secret rotated with new value\n2. Old secret revoked at provider\n3. All references updated to use env var\n4. Re-scan confirms zero exposure\n5. Git history cleaned if applicable"
```

For git history cleanup (when secrets were committed historically):

```
Tool: mcp__mcp-graph__node
Params:
  action: "add"
  name: "SECRET-HISTORY: Clean <secret-type> from git history"
  type: "task"
  priority: "high"
  description: "Secret was found in git history at commit <sha>. Even though removed from HEAD, the secret is still accessible via git log. Requires: 1) Confirm secret is rotated. 2) Use git-filter-repo to remove from history. 3) Force push (coordinate with team). 4) All contributors must re-clone."
  acceptanceCriteria: "1. Secret not found in any git commit\n2. Secret has been rotated\n3. All team members re-cloned"
```

### Step 9: Persist Audit Results to Memory

```
Tool: mcp__mcp-graph__write_memory
Params:
  title: "Secret Management Audit — <date>"
  content: "<scan results, findings count by severity, secrets rotated, vault health status, remediation nodes created, git history findings>"
  tags: ["secrets", "vault", "rotation", "security", "audit", "leak-detection"]
```

## Output Format

```
Phase: SECRET MANAGEMENT AUDIT
Scan Scope: N source files, N git commits

Codebase Scan:
  Critical: N findings
  High: N findings
  Medium: N findings
  Low: N findings
  False Positives Filtered: N

Git History Scan:
  Secrets in History: N (N already rotated, N need rotation)
  Deleted Sensitive Files: N

Vault Health:
  Status: HEALTHY / DEGRADED / UNINITIALIZED
  Tracked Secrets: N
  Overdue for Rotation: N
  Last Backup: <date>

Rotations Performed:
  Auto-Rotated: N
  Manual Rotation Required: N (task nodes created)
  Revocations Pending: N

Verification:
  Re-scan Clean: YES / NO (N remaining exposures)
  .gitignore Coverage: N sensitive paths covered

Remediation Nodes Created: N
  Emergency: N
  Urgent: N
  Scheduled: N

Overall Secret Management Grade: A-F

Saved to memory: "Secret Management Audit — <date>"
```

## Anti-Patterns

- Do NOT rely solely on pattern matching — high-entropy analysis catches secrets that don't match known patterns
- Do NOT skip git history scanning — a secret removed from HEAD is still exposed in git history to anyone with repo access
- Do NOT rotate secrets without updating all references first — broken references cause outages
- Do NOT store the vault master key in the same repository as the vault — use OS keychain or separate secure storage
- Do NOT ignore false positive tuning — too many false positives cause alert fatigue and real findings get missed
- Do NOT assume `.env` files are safe — verify `.gitignore` covers them and they have restrictive file permissions
- Do NOT treat test/dev secrets as non-sensitive — dev credentials often have production-adjacent access
