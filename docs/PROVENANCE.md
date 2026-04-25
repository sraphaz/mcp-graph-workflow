# Provenance — mcp-graph

This document describes the cryptographic and legal provenance layers that
anchor the authorship of **mcp-graph**. The goal is to make the "who and
when" of every release artifact publicly verifiable, independent of any
single platform (GitHub, npm, or the maintainer's personal identity).

Authoritative author: **Diego Lima Nogueira de Paula**
([ORCID 0009-0002-1117-9571](https://orcid.org/0009-0002-1117-9571)).

---

## Layer 1 — Signed commits and tags (forward-only)

Policy: commits and tags authored after signing rollout carry an SSH
signature bound to `DiegoNogueiraDev`'s GitHub identity. Older commits
remain unsigned and are anchored by other means (Layer 3 + npm registry
timestamps).

### Keys in use

- **Algorithm:** Ed25519 (SSH signing).
- **Public key:** `~/.ssh/id_ed25519.pub` on the maintainer's workstation,
  registered against the `DiegoNogueiraDev` GitHub account under
  [Settings → SSH and GPG keys → Signing keys](https://github.com/settings/keys).
- **GitHub "Verified" badge** appears on every commit and tag object whose
  signature matches a registered signing key.

### Verifying locally

```bash
git clone https://github.com/DiegoNogueiraDev/mcp-graph-workflow.git
cd mcp-graph-workflow

# Per-commit signature status. %G? prints:
#   G = good signature, U = good but untrusted (key not imported locally),
#   N = no signature, B = bad signature.
git log --format='%h %G? %s' -20

# Per-tag signature contents.
git for-each-ref --format='%(refname:short) %(contents:signature)' refs/tags/ | head
```

### What signing proves

- The commit/tag object was produced by someone holding the private signing
  key registered against `DiegoNogueiraDev`.
- The commit's tree, parents, author, and message have not been altered
  after signing.
- The signing key was valid at the time of signing.

It does **not** prove semantic correctness of the code, only the identity
chain.

---

## Layer 2 — OpenTimestamps anchoring

For each release, the commit SHA is anchored to the Bitcoin blockchain via
[OpenTimestamps](https://opentimestamps.org/). Proofs live under
[`docs/_internal/provenance-ots/`](provenance/ots/) and are committed to the
repository.

### Where the proofs live

```
docs/_internal/provenance-ots/mcp-graph-v10.0.0.commit-hash.txt
docs/_internal/provenance-ots/mcp-graph-v10.0.0.commit-hash.txt.ots
docs/_internal/provenance-ots/mcp-graph-v10.0.1.commit-hash.txt
docs/_internal/provenance-ots/mcp-graph-v10.0.1.commit-hash.txt.ots
docs/_internal/provenance-ots/mcp-graph-v10.0.2.commit-hash.txt
docs/_internal/provenance-ots/mcp-graph-v10.0.2.commit-hash.txt.ots
```

Each `.txt` file contains the release commit SHA (one line). The matching
`.ots` file is the OpenTimestamps proof produced by `ots stamp`.

### Verifying a proof

```bash
# Install the ots CLI once.
brew install opentimestamps-client            # macOS
pipx install opentimestamps-client            # cross-platform

# Verify any release.
ots verify docs/_internal/provenance-ots/mcp-graph-v10.0.1.commit-hash.txt.ots
```

Immediately after stamping, `ots verify` reports *"Pending attestation in
Bitcoin blockchain"* — the proof exists but has not yet been included in a
Bitcoin block. After the next few hours (typically), `ots upgrade` folds
the attestation into a block-confirmed proof.

### What OTS proves

- The commit SHA existed in the form and content it has now **by the date
  of the earliest Bitcoin block** that includes it.
- Nobody — including the maintainer — can retroactively change the commit
  without breaking the proof.

### Scope

OTS is applied forward-only from the AGPL transition (v10.0.0 onward). Old
MIT releases are not OTS-anchored; Layer 1 (forward-only signing) and
the Brazilian statutory protection described in Layer 3 provide their
coverage.

---

## Layer 3 — Brazilian statutory protection (Lei 9.609/1998)

Brazilian copyright law protects software automatically, from the moment
of creation, independent of any registration formality. Two statutes apply:

- **Lei 9.610/1998** ("Lei dos Direitos Autorais") establishes copyright
  protection as automatic upon creation.
- **Lei 9.609/1998** ("Lei do Software") Art. 2º §2º places software under
  the copyright regime with a **50-year protection term**, counted from
  January 1 of the year following first publication (or, absent
  publication, of creation).

mcp-graph is therefore protected by Brazilian law from its creation date
in 2025, 50 years forward, regardless of INPI registration status. The
authorship chain is established by:

- The author's Master's research records at UNOPAR (private work from
  2025 onward).
- The first public commit on GitHub (2026-03-09) and every subsequent
  signed commit.
- npm registry publish timestamps.
- OpenTimestamps proofs in `docs/_internal/provenance-ots/` (Layer 2).

### INPI registration — optional evidentiary reinforcement

Registering the source code with the
[Brazilian National Institute of Industrial Property (INPI)](https://www.gov.br/inpi/en)
under Lei 9.609/1998 is **optional**. It does not create or extend the
50-year protection — that protection already exists automatically. What
INPI registration adds is a government-issued certificate with a fixed
date and a sealed copy of the code, which carries evidentiary weight in
Brazilian court proceedings.

**Current status:** INPI registration is being prepared. The GRU (federal
fee receipt) is paid; documentation is assembled; formal submission to
INPI is pending. Once the protocol number is issued and (later) the
certificate granted, this section will be updated with the respective
identifiers and dates.

Until then, readers and counterparties should treat Layer 3 as resting on
the automatic statutory protection, not on INPI registration.

### Important limits

- Neither Lei 9.609 nor Lei 9.610 grants a **patent**. Brazilian software
  patents are governed by Lei 9.279/1996 and have separate (narrow)
  requirements.
- Statutory protection is a supplement to, not a replacement for, the
  AGPL-3.0-or-later license published on GitHub and npm. Users and
  licensees derive their rights from the license terms, not from the
  underlying copyright framework.

---

## Retag campaigns

In the normal flow, the release-please action creates release tags via
GitHub's REST API, which produces **unsigned** annotated tags. Immediately
after each release publishes to npm, the maintainer re-signs the tag in
place with the Ed25519 key (Layer 1) and force-pushes. This preserves the
tag-points-to-release-commit invariant while closing the Layer 1 gap.

Because the re-sign happens shortly after the release, the signature date
on recent tags can differ from the release date by up to ~hours.

### Known retag events

| Date (UTC)  | Tags retagged                                       | Reason                                    |
|-------------|------------------------------------------------------|-------------------------------------------|
| 2026-04-19  | `mcp-graph-v10.0.0`                                  | Initial AGPL release — closed Layer 1 gap |
| 2026-04-19  | `mcp-graph-v10.0.1`, `mcp-graph-v10.0.2`             | Post-release retag campaign; also OTS-anchored in the same window. |

The same SSH key (fingerprint `SHA256:2XlH7Po+uQkKlUEiFp7b7Ey3zse0X9yxlH3K9RamjtQ`)
signed all three tags. The underlying release commit SHAs are unchanged;
only the tag object signatures were refreshed. Release dates themselves
remain verifiable via:

- npm registry publish timestamps — `npm view @mcp-graph-workflow/mcp-graph time`
- GitHub commit authorship dates — shown on the release commit page
- OpenTimestamps proofs under [`docs/_internal/provenance-ots/`](provenance/ots/)

---

## Forward-only policy (tags < v10.0.0)

Tags published before v10.0.0 (MIT era: v4.x through v9.4.0) remain
**unsigned** by design. Retroactively signing every historical tag would
create ambiguity about the policy itself and does not add practical value —
those releases are anchored instead by:

- npm publish timestamps — each version has a registry-side `time` field.
- GitHub commit authorship dates — visible on the commit page of each tag.
- The author's Master's program records at UNOPAR.

If a specific older release ever becomes disputed in a way that requires
signature-level provenance, that tag can be retagged individually; the
`## Retag campaigns` section above documents the policy for how to do so.

---

## Contact

- Licensing: see [`COMMERCIAL.md`](../COMMERCIAL.md).
- Security reports: see [`SECURITY.md`](../SECURITY.md).
- Academic citation: see [`CITATION.cff`](../CITATION.cff) and
  [`NOTICE.md`](../NOTICE.md).
- Direct maintainer contact: [@DiegoNogueiraDev on GitHub](https://github.com/DiegoNogueiraDev).

*Last updated: 2026-04-19.*
