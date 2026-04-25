# MCP RCE Hardening — OX Security Disclosure Response

> Track of concrete mitigations applied in `mcp-graph` in response to
> OX Security's disclosure of an architectural class of remote-code-execution
> and prompt-injection flaws affecting Anthropic's Model Context Protocol
> (MCP) SDK ecosystem (reported April 2026, covering Python, TypeScript,
> Java, Rust SDKs; >150M downloads, ~200K potentially exposed servers).

## Scope of the disclosure

OX Security identified four reproducible attack vectors inherited by any
project built on top of the stock MCP SDK:

| # | Vector | Attacker surface |
|---|---|---|
| 1 | **UI injection** | Tool output rendered as HTML/markdown without sanitisation inside the host (IDE, dashboard, chat client). |
| 2 | **Hardening bypasses** | Structured args validated by shape but not by content — e.g. a `path` field containing `../../../etc/passwd`, a `url` containing `file://`. |
| 3 | **Zero-click prompt injection** | Tool fetches attacker-controlled page content; content is embedded in the next LLM turn and silently issues new tool calls. Confirmed in Windsurf and Cursor. |
| 4 | **Marketplace poisoning** | 9 of 11 audited MCP registries serve unverified third-party servers. A compromised `npx` install = RCE. |

Live exploits were confirmed by OX against LiteLLM, LangChain, and IBM
LangFlow. 10+ CVEs, several still unpatched at time of disclosure.
Anthropic classified the behaviour as "expected" and declined a protocol
fix; the burden sits on downstream projects to add a governance layer.

## mcp-graph's response — four concrete controls

All code below lives under `src/core/security/` and is wired through the
normal MCP tool registration pipeline. Zero-config: every tool is protected
automatically.

### 1. STDIO argument sanitiser — `stdio-sanitizer.ts`

Maps each boundary value to one of five kinds and enforces strict content
rules before the value can reach `execFile`, `fetch`, or a CDP socket.

| Kind | Accepts | Rejects |
|---|---|---|
| `path` | relative & absolute filesystem paths | `..` segments, NUL bytes, `file://` / `data:` / `javascript:` URIs, strings >4096 bytes |
| `url` | `http(s)://`, `ws(s)://` | `file:`, `data:`, `javascript:`, `vbscript:`, malformed URLs |
| `identifier` | `^[A-Za-z_][A-Za-z0-9_-]{0,127}$` | spaces, punctuation, unicode tricks |
| `command-arg` | alphanumerics + dashes | `; | & \` $ $(…) \${…} > < \\ \n` and tabs |
| `cdp-method` | `Page.*`, `DOM.*`, `Runtime.*`, `Network.enable`, … | `Browser.close`, `Security.setIgnoreCertificateErrors`, `Network.setCookies`, unknown domains |

API: `safeArg(value, kind) → string` (throws `StdioSanitizationError`).
Batch form: `safeArgv(values, kind) → string[]`.
CDP-specific: `assertCdpMethod("Page.navigate")` throws on deny-listed or
out-of-allowlist methods.

Covers disclosure vectors **2** and **3**.

### 2. AST-level source validator — `ast-source-validator.ts`

Any time a tool or user-submitted payload is turned into executable code
(today: browser-harness `add_helper`), the source is **parsed** — not
grepped — and walked node-by-node. A regex-only scan is trivially bypassed
by string concatenation (`globalThis['pro'+'cess']`, `global['re'+'quire']`).
The AST walker defeats that class of bypass:

- Rejects any `Identifier` node matching
  `process, require, eval, Function, global, globalThis, Deno, Bun,
  __dirname, __filename, module, exports, WebAssembly, SharedArrayBuffer`.
- Rejects `MemberExpression` / `PropertyAccess` to `__proto__`, `constructor`,
  `prototype`.
- Rejects `ElementAccess` with a string argument (or string-concat
  expression) that resolves to any banned identifier — catches obfuscation.
- Rejects dynamic `import(...)` and `import.meta`.
- Enforces a 16 KB byte cap (configurable).

Regex + runtime `vm.Context` sandboxing remain as layers 1 and 3. AST is
layer 2 — required for defence in depth.

Covers disclosure vectors **2** and **3**.

### 3. Registry allowlist — `registry-allowlist.ts`

Every MCP server entry written to `.mcp.json` (or merged in via the
integrations system) is checked against a strict allowlist before the user
config is persisted.

| Check | Pass requirement |
|---|---|
| **Command** | must be in `{node, npx, deno, bun}` — `sh`, `bash`, arbitrary binaries rejected |
| **Shell metacharacters** | no `|`, `;`, backtick, `$(…)` anywhere in argv — blocks `curl … | sh` patterns |
| **`npx` spec format** | must be `name@X.Y.Z` exact semver OR `github:owner/repo#<40-hex-sha>` — ranges, tags, `latest`, and unpinned specs rejected |
| **Scope / package allowlist** | default scopes: `@modelcontextprotocol`, `@anthropic-ai`, `@mcp-graph-workflow`, `@upstash`, `@playwright`; user-supplied entries must be explicitly added |

Wired into `buildMcpServersConfig(existing, { allowlistMode: "warn" | "strict" })`.
Default is `warn` (logs and continues) for backwards compatibility with
existing `.mcp.json` files. Projects that want hard-fail semantics can
switch to `"strict"`.

Covers disclosure vector **4** (marketplace poisoning).

### 4. Tool-invocation audit + redaction + rate limit — `tool-invocation-audit.ts`

A single wrapper function `wrapToolHandler(name, handler, sink, opts)`
decorates every MCP tool at registration time. For each invocation it:

1. Captures the args, redacts secrets (`sk-ant-…`, `ghu_…`, `ghp_…`, `gho_…`,
   `AKIA…`, `xoxb-…`, and any field named `apiKey`/`token`/`password`/`secret`/`authorization`).
2. Truncates the preview to 1 KB.
3. Records `{tool, at, durationMs, ok, argsPreview, errorMessage?}` to an
   `AuditSink` (the existing `tool_call_log` SQLite table).
4. Enforces a configurable rate limit per tool per minute; throws
   `RateLimitExceededError` past the threshold.

All four mitigations use the `SECRET_PATTERNS` regex set, and the redacted
preview is what lands in logs — the raw value never leaves the boundary.

Covers disclosure vector **1** (observability of what the tool did) and
transitively **3** (injected tool calls show up in the audit trail even if
the scrubber missed something).

## Error taxonomy

New typed errors exported from `src/core/utils/errors.ts`:

```ts
StdioSanitizationError         // kind, reason, offending value
UntrustedRegistryError         // spec, reason
PromptInjectionDetectedError   // category, sample
SourceValidationError          // readonly violations[]
RateLimitExceededError         // scope, limitPerMinute
```

All extend `McpGraphError`, so existing error-handling paths catch them
without changes.

## Tests

55+ unit tests under `src/tests/security/`:

- `stdio-sanitizer.test.ts` — 20 tests, every kind × pass/fail.
- `ast-source-validator.test.ts` — 17 tests, including the
  `globalThis['pro'+'cess']` obfuscation corpus.
- `registry-allowlist.test.ts` — 12 tests covering npm-spec pinning
  semantics and `curl | sh` rejection.
- `tool-invocation-audit.test.ts` — 5 tests covering redaction, truncation,
  rate-limit window, error propagation.

Run the lot:

```bash
npx vitest run src/tests/security/
```

## What we did **not** do (and why)

- **Protocol-level fix.** OX recommended one; Anthropic declined. We
  implement governance on top of the SDK rather than forking it.
- **Block all `npx`.** That would break the default MCP ecosystem. We pin
  versions and restrict scopes instead.
- **Strict-only mode by default.** Switching to strict for existing users
  would silently break their `.mcp.json`. We warn today; strict can be
  opted-in per-project via `allowlistMode: "strict"`.
- **Auto-scrub tool output rendered in the dashboard.** The existing
  `input-sanitizer.ts` handles detection today; a DOMPurify pass over all
  rendered tool output is tracked as Phase 3 P1 (not shipped in this
  patch).

## Residual risk

- **Local filesystem access.** Tools that legitimately touch files still
  have the process-level permissions of the node runtime; sandboxing those
  is an OS-level concern (bubblewrap, Docker, macOS sandbox-exec).
- **LLM turn content.** `input-sanitizer.ts` detects common PI patterns but
  a motivated attacker can word-smith past detection. Defence in depth:
  the AST validator ensures any code the LLM asks to run is still
  filtered regardless of how the request was phrased.
- **Registry compromise of an allowlisted scope.** If `@modelcontextprotocol/*`
  itself is poisoned, pinning only helps to the extent that the pinned
  version was uploaded before compromise. Integrity/SHA verification of
  installed packages is on the roadmap (Phase 3 P2).

## Related files

| Path | Role |
|---|---|
| `src/core/security/stdio-sanitizer.ts` | safe-arg + CDP-method validation |
| `src/core/security/ast-source-validator.ts` | AST walk for dynamic source |
| `src/core/security/registry-allowlist.ts` | MCP-server allowlist + pin check |
| `src/core/security/tool-invocation-audit.ts` | handler middleware, redaction, rate limit |
| `src/core/security/input-sanitizer.ts` | pre-existing PI pattern detector |
| `src/core/browser-harness/self-heal.ts` | wires AST validator into helper add-flow |
| `src/core/integrations/mcp-servers-config.ts` | wires allowlist into config builder |
| `src/core/utils/errors.ts` | new typed error classes |

## References

- OX Security disclosure (April 2026)
- CVE corpus and patched versions — see upstream SDK changelogs
- Disclosure policy: [`SECURITY.md`](../SECURITY.md)
- Branch of record for these patches: `claude/implement-guardrails-resolver-5WvFS`
