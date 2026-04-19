# Licensing — practical guide

> **Disclaimer.** This document is a plain-language summary of how the
> Project Owner interprets the AGPL-3.0-or-later obligations for typical
> mcp-graph deployments. **It is not legal advice.** The binding legal text
> is in [`LICENSE`](../LICENSE); if Your deployment, risk tolerance, or
> jurisdiction is non-trivial, consult a lawyer. The examples below reflect
> the Project Owner's view and mainstream FSF interpretation of AGPL §13,
> but courts have never tested §13 in depth — edge cases genuinely remain
> open questions.
>
> For the full legal text, see [`LICENSE`](../LICENSE). For commercial
> options, see [`COMMERCIAL.md`](../COMMERCIAL.md).

mcp-graph v10.0.0+ is distributed under AGPL-3.0-or-later. The AGPL is a
strong copyleft license with one key differentiator over GPL-3.0:

> **§13 — Remote Network Interaction / Requiring Source for Users.**
> If you modify the program and let users interact with it remotely through
> a computer network, you must offer those users the Corresponding Source of
> your modifications under the AGPL, at no charge.

The rest of this document answers: **does §13 apply to my deployment?**

---

## Decision matrix

| Deployment scenario                                                           | Triggers §13? | What you must do                                                       |
|-------------------------------------------------------------------------------|:-------------:|------------------------------------------------------------------------|
| You use `mcp-graph` CLI on your own laptop for personal projects              |      No       | Nothing beyond general AGPL terms (attribution, no restriction).       |
| You run `mcp-graph serve` locally, connected only to your own agent          |      No       | Nothing — only you "interact through the network."                     |
| Your team runs one shared `mcp-graph serve` instance for internal developers  |     **Yes**   | Your developers are remote users — offer them Corresponding Source.    |
| You embed mcp-graph into an internal SaaS used by company employees           |     **Yes**   | Offer Corresponding Source to those employees (can be internal repo).  |
| You embed mcp-graph into a public SaaS with external paying customers         |     **Yes**   | Offer Corresponding Source to every external user interacting with it. |
| You ship `mcp-graph` binaries as part of a desktop app to end users           |      No¹      | AGPL §5 applies (distribution): provide source with the binary.        |
| You publish a fork on GitHub under AGPL-3.0-or-later                          |      No²      | Your fork itself is the Corresponding Source — you comply by default.  |
| You use mcp-graph inside internal CI with no external users                   |      No       | Only CI runs it; no humans "interact through the network."             |
| You offer a hosted "mcp-graph-as-a-service" to paying tenants                 |     **Yes**   | Offer Corresponding Source to every tenant. Or get a commercial license. |
| You modify mcp-graph's scheduler and expose it as a proprietary API service   |     **Yes**   | Publish scheduler source under AGPL, OR negotiate a commercial license. |

¹ No §13 *if no network interaction*; but §5 (distribution) independently
  requires source with the binary.
² Provided your derivative work's license is genuinely AGPL-3.0-or-later
  and source is genuinely accessible (public repo is the canonical form).

---

## "Interact remotely through a network" — what counts

§13 turns on whether a **third party** (not you) interacts with your
**modified** mcp-graph **through a network**. Three tests, all must be true:

1. **Someone other than the modifier interacts** with the program.
2. **The interaction crosses a network** (not in-process, not intra-laptop).
3. **The running program is a modified version** of mcp-graph (or includes
   modifications).

If you pass all three, §13 applies and you owe Corresponding Source to
those users.

**Running unmodified mcp-graph over a network is permitted without §13
source-disclosure** — §13 is triggered by *modifications*. However, in
practice any non-trivial integration (custom MCP tools, custom schemas,
patched routes) counts as a modification.

---

## What is "Corresponding Source"

AGPL's definition is broad. For mcp-graph deployments, it typically includes:

- The full modified TypeScript source tree.
- Your `package.json`, build scripts, migrations, and Dockerfile (if any).
- Configuration files needed to build the program from source.
- Any scripts that control installation or execution of the modified
  version.
- **Not** required: data (SQLite contents), user PRDs, sensitive secrets,
  the surrounding stack that is **not** linked with mcp-graph's code.

A common-sense test: if a user downloaded your Corresponding Source, they
should be able to build and run the same modified mcp-graph you are running.

---

## How to comply — minimum checklist

If §13 applies to your deployment:

1. **Host your modified source** somewhere stable and public (GitHub,
   GitLab, a static file on your own server). AGPL requires "reasonable"
   access — a public repo is the canonical answer.
2. **Link from the running service** to the source. A footer link, a
   `/source` endpoint, or a MOTD banner on the MCP server all qualify.
3. **Keep source in sync** with what is deployed. If you ship a patch on
   Monday, the source URL must reflect that version by the time a user
   asks.
4. **Include the AGPL notice** in your user-facing interface (typically a
   `/license` endpoint or a menu entry that displays `LICENSE`).
5. **Preserve the existing copyright notices** in the files you modified
   — do not strip the SPDX headers or the `© 2026 Diego Lima Nogueira de
   Paula` attribution.
6. **If you accept contributions from your own users**, make sure they
   submit under AGPL or a compatible license — do not accept proprietary
   contributions that you then try to redistribute.

---

## FAQ

**Q: I use mcp-graph in a closed-source product sold to enterprises. Can I
just publish the mcp-graph fork and keep my product closed?**

A: Yes — **if** your product is genuinely separate from mcp-graph (no
linking, no deep integration) and mcp-graph is distributed alongside it
under AGPL. If your product calls mcp-graph as an embedded library, the
AGPL's reach extends further (§5 governs derivative works). Safe path:
negotiate a commercial license.

**Q: Our legal team says "no AGPL in production." What now?**

A: Get a commercial license via [`COMMERCIAL.md`](../COMMERCIAL.md). This is
the primary reason the dual-licensing model exists.

**Q: I just want to use the CLI locally, do I need to do anything?**

A: No. Local CLI use by yourself is unambiguously permitted with no
source-disclosure obligation, as long as you do not modify and redistribute.

**Q: Can I publish a blog post or paper using mcp-graph?**

A: Yes, always. Citation is requested — see [`CITATION.cff`](../CITATION.cff)
and [`NOTICE.md`](../NOTICE.md).

**Q: Does §13 apply to MCP stdio?**

A: MCP over stdio (pipe between Claude Desktop and `mcp-graph`) is **not** a
network interaction — the two processes run on the same host with no
network hop. §13 does not apply.

**Q: Does §13 apply to a shared Tailscale/VPN deployment for my team?**

A: Yes. Tailscale is a network; team members are remote users; if the
instance is modified, you owe them Corresponding Source. In practice,
that means hosting your fork's repo where the team can read it.

---

## Provenance and enforcement

Copyright and authorship of mcp-graph are anchored cryptographically via
the three layers documented in [`PROVENANCE.md`](./PROVENANCE.md):

1. **GPG-signed commits and tags** — every commit in the authoritative
   history carries a cryptographic signature of the copyright holder.
2. **OpenTimestamps** — critical commits are anchored to the Bitcoin
   blockchain, providing a publicly verifiable creation date.
3. **Brazilian statutory protection (Lei 9.609/1998)** — mcp-graph is
   protected automatically by Brazilian software-copyright law for 50
   years from January 1 of the year after first publication. INPI
   registration (additional evidentiary reinforcement, optional) is in
   preparation; see [`PROVENANCE.md`](./PROVENANCE.md#layer-3--brazilian-statutory-protection-lei-96091998).

In a licensing dispute, these layers establish authorship and date with
cryptographic proof. They apply to both AGPL compliance audits and
commercial license disputes.

---

## Summary — the three paths

| Your situation                                                     | Path                                          |
|--------------------------------------------------------------------|-----------------------------------------------|
| You can publish your modifications under AGPL-3.0-or-later.        | Use the AGPL version — follow the checklist.  |
| You cannot publish modifications but want to use mcp-graph.        | Buy a commercial license — see COMMERCIAL.md. |
| You only use mcp-graph locally, unmodified, for your own work.     | No action needed — AGPL does not burden you.  |

*Last updated: 2026-04-19.*
