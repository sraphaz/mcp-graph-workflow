# Security Policy

> **Hardening against the OX Security MCP RCE disclosure** — see
> [`docs/SECURITY-HARDENING-MCP-RCE.md`](docs/SECURITY-HARDENING-MCP-RCE.md)
> for the concrete mitigations shipped in `mcp-graph`'s governance layer
> (STDIO arg sanitiser, AST source validator, npm-registry allowlist,
> tool-invocation audit with secret redaction + rate limits).

## Supported Versions

mcp-graph is an independent research project maintained by
**Diego Lima Nogueira de Paula**. Security fixes are backported only to the
currently-supported major line.

| Version | Supported | License | Notes |
|---------|:---------:|---------|-------|
| `10.x`  | ✅        | AGPL-3.0-or-later + commercial | Current stable. Security fixes land here. |
| `9.x`   | ⚠️ best-effort only | MIT (last: `9.4.0`) | Deprecated on npm with a pointer to `COMMERCIAL.md`. Critical vulnerabilities may be backported case by case, with no SLA. |
| `< 9`   | ❌        | MIT       | No further releases. Upgrade to `10.x`. |

Commercial licensees receive security fixes under the terms of their signed
license agreement — see [`COMMERCIAL.md`](COMMERCIAL.md).

## Reporting a Vulnerability

### Preferred channel — GitHub Security Advisories

Report privately via
<https://github.com/DiegoNogueiraDev/mcp-graph-workflow/security/advisories/new>.

This creates a private advisory visible only to the maintainer. Include:

- A description of the vulnerability and attack scenario.
- Affected versions / commits / configurations (e.g. MCP stdio only,
  `mcp-graph serve` only, dashboard only).
- Proof-of-concept input, payload, or exploit steps.
- Your preferred disclosure window if any.
- Whether you want credit in the advisory (name / handle / link).

### Alternative channel — email

`devnogueiradiego@gmail.com` with subject `[SECURITY] mcp-graph <short description>`.
GitHub Security Advisories are preferred because they keep the conversation
private end-to-end; email is the fallback.

## What counts as a vulnerability

In scope:

- Remote code execution (RCE) via MCP server, REST API, CLI, or the
  dashboard.
- SQL injection against the SQLite store.
- Path traversal through `read_file`, PRD import, or any tool accepting a
  path argument.
- Authentication or authorization bypass in the dashboard / API.
- Secret leakage via logs, telemetry, or on-disk state.
- Denial of service via unbounded memory / disk growth or algorithmic
  complexity attacks (hash flooding, zip bombs, etc.).
- Supply-chain concerns around `optionalDependencies` (e.g. intelephense,
  tree-sitter grammars) that mcp-graph pulls in.
- Deserialization / arbitrary-code concerns in PRD parsers
  (PDF, DOCX, HTML, Markdown).

Out of scope for a security report (file a regular issue instead):

- Bugs without a security impact.
- License-compliance questions — use `COMMERCIAL.md` channel or open a
  regular issue.
- Feature requests or missing authentication on endpoints that are
  documented as "local-only".

## Response SLA

- **Acknowledgement:** within **5 business days** of report receipt.
- **Initial triage & severity scoring:** within **10 business days**.
- **Fix window:** varies by severity, negotiated with the reporter:
  - Critical (RCE, data loss): target 15 days.
  - High: target 30 days.
  - Medium / Low: next regular release window.

These are targets from a solo maintainer, not contractual commitments.
Commercial licensees get SLA terms in their agreement.

## Disclosure policy

Default: **90-day coordinated disclosure.** The maintainer and reporter
coordinate on a public advisory, CVE request (when applicable), and
release notes. The reporter is credited unless they opt out.

If the 90-day window expires without a fix and no extension has been
agreed, the reporter is free to disclose publicly.

## Provenance of fixes

Every security fix lands as:

1. A commit GPG/SSH-signed by the maintainer (PROVENANCE Layer 1 in
   [`docs/PROVENANCE.md`](docs/PROVENANCE.md)).
2. A signed, OpenTimestamps-anchored release tag (PROVENANCE Layer 2);
   proofs live under [`docs/provenance/ots/`](docs/provenance/ots/).
3. A GitHub Security Advisory with a unique `GHSA-*` identifier and, when
   the issue warrants, a CVE assigned via GitHub's CNA.

This lets downstream users verify the origin and date of the fix
independent of GitHub.

## Trusted contact

- GitHub: [@DiegoNogueiraDev](https://github.com/DiegoNogueiraDev)
- ORCID: [0009-0002-1117-9571](https://orcid.org/0009-0002-1117-9571)
- Academic affiliation: UNOPAR — Programa de Pós-Graduação em Engenharia
  da Computação

*Last updated: 2026-04-19.*
