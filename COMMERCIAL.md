# Commercial Licensing — mcp-graph

> **Important.** This page is **informational only**. It describes the kinds
> of commercial license the Project Owner is willing to discuss and the
> typical shape of such agreements. It is **not an offer** and **not legal
> advice**. The binding terms are only those set out in a written commercial
> license agreement that the Project Owner and the licensee both sign.
> Prices, scope, warranties, and indemnification are negotiated per deal.

Starting with **v10.0.0**, mcp-graph is distributed under
**AGPL-3.0-or-later** (see [`LICENSE`](LICENSE)).

The AGPL is a strong copyleft license. In particular, **§13 (Remote Network
Interaction)** requires that if you modify mcp-graph and expose it to users
over a network — whether as an MCP server, REST API, or integrated product —
you must offer those users the complete corresponding source code of your
modifications, under AGPL-3.0-or-later.

If your organization cannot or does not wish to comply with the AGPL, a
**commercial license** is available.

---

## Who needs a commercial license

You likely need a commercial license if **any** of the following apply:

- You deploy mcp-graph as a network-accessible service (MCP server, REST
  API, SaaS product) and do **not** want to release your modifications,
  integrations, or surrounding orchestration code under AGPL.
- You embed mcp-graph or derivative works into a proprietary product you
  distribute to customers without source code.
- You offer mcp-graph as a hosted service to paying customers and want to
  keep your operational layer (auth, multi-tenancy, billing, pipelines)
  closed.
- Your internal legal policy prohibits AGPL-licensed code from touching
  production systems (common in regulated industries).
- You want indemnification, a signed license agreement on your paper, or
  a specific liability cap that AGPL does not provide.

You **do not** need a commercial license if:

- You run mcp-graph locally as a CLI tool for personal or internal dev use
  (no external users).
- You run mcp-graph privately on your laptop as an MCP server connected to
  a local agent (Claude Desktop, Cursor, etc.) for your own use.
- You publish your derivative works and integrations under AGPL-3.0-or-later
  and make the complete corresponding source available to network users.
- You use mcp-graph inside a CI pipeline that is not exposed to external
  users.

See [`docs/LICENSING.md`](docs/LICENSING.md) for concrete scenarios and a
§13 decision matrix.

---

## What a commercial license provides

A commercial license typically grants the following, subject to the specific
agreement:

- **No copyleft obligation** — you may modify, embed, and deploy mcp-graph
  without the source-disclosure requirements of AGPL §13 and §5.
- **Proprietary derivatives** — you may integrate mcp-graph into closed
  products and distribute compiled binaries without source.
- **Redistribution rights** — subject to the agreement's scope (internal
  deployment, embedded OEM, SaaS service, etc.).
- **Warranty and indemnification** — negotiable; the AGPL is offered
  "as is" with no warranty.
- **Priority support** — optional, via a separate support addendum.

The commercial license does **not** alter or revoke the AGPL-licensed version
for any other user.

---

## Typical licensing models

1. **Evaluation** — free, time-limited, non-production. Request via the
   contact channel below.
2. **Per-instance** — annual fee per running production instance.
3. **Per-seat** — annual fee per engineer/developer using mcp-graph.
4. **Enterprise / OEM** — flat fee for unlimited internal use or embedded
   distribution within a defined product line.
5. **SaaS / hosted** — fee scales with revenue or usage of the hosted
   service.

Pricing is negotiated case by case. Academic, research, and non-profit uses
may qualify for reduced-rate or courtesy licenses.

---

## How to obtain a commercial license

Contact the copyright holder directly:

- **Copyright holder:** Diego Lima Nogueira de Paula
- **Primary contact:** open an issue on the GitHub repository tagged
  `commercial-license` with a short description of your intended use, or
  contact via the address listed on the repository's
  [package.json `author`](package.json) field.
- **Please include:**
  - A brief description of how you plan to deploy mcp-graph.
  - Approximate scale (users, instances, requests/month).
  - Your legal entity name and country of operation.
  - Preferred licensing model (from the list above) and timeline.

A draft commercial agreement will be sent for review. Typical turnaround is
under 15 business days for standard cases.

---

## Provenance and authorship

The copyright chain, research history, and authorship of mcp-graph are
documented in [`NOTICE.md`](NOTICE.md) and anchored cryptographically via
three independent layers described in
[`docs/PROVENANCE.md`](docs/PROVENANCE.md):

1. GPG-signed commits and tags.
2. OpenTimestamps anchoring to the Bitcoin blockchain.
3. Registration with the Brazilian INPI under Law 9.609/1998.

These layers also underpin commercial license audits — they establish the
authorship and date of each code artifact with cryptographic proof.

---

## Trademark note

"MCP Graph Workflow" and `mcp-graph` are project identifiers. A commercial
license does **not** grant any right to use these names to market a derivative
or competing product. If you need trademark usage rights, raise it explicitly
when requesting the commercial license.

---

*Last updated: 2026-04-19. This document is informational; the binding legal
terms are those signed in the commercial license agreement itself.*
