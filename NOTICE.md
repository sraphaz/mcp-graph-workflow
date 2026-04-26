# NOTICE

## Authorship

**MCP Graph Workflow** is the intellectual work of **Diego Lima Nogueira de Paula**.

The architecture, methodology, and implementation of this system originated as
part of ongoing Master's research in Computer Engineering at **UNOPAR —
Universidade Norte do Paraná** (Postgraduate Program in Computer Engineering,
in progress as of 2026).

**Research timeline.** Private research and prototyping began in **2025**; the
public repository was opened on **2026-03-09** after roughly a year of
methodological work. The extended private timeline is documented in the
author's Master's program records and is verifiable through the program
coordinators at UNOPAR.

**Licensing.** The source code is released under the **GNU Affero General
Public License v3.0 or later** (AGPL-3.0-or-later — see [`LICENSE`](LICENSE)
and the plain-language guide in [`docs/LICENSING.md`](docs/LICENSING.md)).
The AGPL grants broad permissions for use, modification, and redistribution
under copyleft terms — in particular, **§13** requires that modifications
exposed over a network be made available in source form to those network
users.

**Commercial licensing.** Organizations that cannot or do not wish to comply
with the AGPL may obtain a commercial license that removes the copyleft
obligations. See [`COMMERCIAL.md`](COMMERCIAL.md) for who qualifies, what
is granted, and how to request one.

This notice documents the authorship chain and does **not** reduce or alter
the rights granted by AGPL-3.0-or-later.

## Request for Academic Citation

When this system — or any substantial idea, architecture, or methodology
derived from it — is referenced in:

- academic publications (journal articles, conference papers, book chapters)
- theses, dissertations, or qualifying exams
- technical presentations at conferences, meetups, or industry events
- derivative or inspired implementations (forks, rewrites, ports to other
  languages or stacks)
- research reports, white papers, or technical documentation
- online articles, blog posts, or video content describing the approach

please cite this work using the canonical reference in
[`README.md` → "How to Cite"](README.md#how-to-cite) or via the
[`CITATION.cff`](CITATION.cff) file, which GitHub surfaces as the
**"Cite this repository"** button on the project page.

The AGPL does not require academic citation, and neither does the commercial
license. Citation is requested as a matter of academic honesty and scientific
integrity whenever the system is discussed, evaluated, or extended in
research or public-facing technical work.

## Provenance of Ideas

The following concepts and design choices are original contributions of this
work and are documented in the author's research:

- PRD-to-graph conversion as the primary authoring surface for agentic
  software engineering.
- The **Harnessability Score** composite metric (seven-dimension evaluation
  of agent readiness), as implemented in `src/core/harness/`.
- The **Task Readiness Score** + Model Router pattern for routing atomic
  work to smaller, cheaper language models — see
  `src/core/planner/task-readiness-score.ts`.
- The nine-phase lifecycle with deterministic phase gates, as encoded in
  `src/core/pipeline/`.
- The **Anti-Vibe-Coding** methodology combining XP discipline with
  graph-backed agentic execution — see project `CLAUDE.md`.

Derivative implementations that adopt any of the above patterns without a
literal code copy are still expected to cite the original work, consistent
with academic convention for methodological contributions.

## Trademarks and Naming

The name **"MCP Graph Workflow"** and the command-line identifier `mcp-graph`
are associated with this project and its author. Reimplementations or forks
should adopt a distinct name to avoid ecosystem confusion. Trademark
registration status is maintained separately and may be updated as the
project evolves.

## Verifying Commits (Cryptographic Attribution)

To anchor authorship against the public git history, releases and release-
adjacent commits on this repository are signed — either with a **GPG** key
or with an **SSH signing key** tied to the author's verified GitHub identity
(`DiegoNogueiraDev`). GitHub surfaces verified commits with a green
"Verified" badge on the commit page.

### What "Verified" on GitHub proves

- The commit was authored by someone holding the private signing key
  registered against `DiegoNogueiraDev`.
- The commit contents (tree, parents, author, message) have not been
  altered after signing.
- The signing key was valid at the time of signing.

It does **not** prove the semantic correctness of the code, only the
identity chain.

### Verifying locally

```bash
# Clone and verify a specific commit:
git clone https://github.com/DiegoNogueiraDev/mcp-graph-workflow.git
cd mcp-graph-workflow
git log --show-signature -1 <commit-sha>

# Or list recent commits with verification status:
git log --format='%h %G? %s' -20
```

`%G?` prints `G` for good signature, `U` for untrusted (key not imported
locally), `N` for no signature, `B` for bad signature.

### Setting up signing (for contributors)

**SSH signing (recommended — simpler, uses the same key you already push with):**

```bash
git config --global commit.gpgsign true
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
```

Then add the SSH public key to your GitHub account's
[**Signing keys**](https://github.com/settings/ssh/new) list (distinct
from "Authentication keys").

**GPG signing:**

```bash
gpg --full-generate-key                       # pick ed25519 or RSA 4096
git config --global user.signingkey <key-id>
git config --global commit.gpgsign true
gpg --armor --export <key-id>                 # paste into GitHub GPG keys
```

The historical commits preceding this setup remain unsigned; signing
applies forward-only. The authorship chain prior to signing rollout is
anchored instead by (a) npm registry timestamps on published versions,
(b) GitHub commit dates, and (c) the author's Master's program records.

## Contact

- GitHub: https://github.com/DiegoNogueiraDev
- ORCID: [0009-0002-1117-9571](https://orcid.org/0009-0002-1117-9571)
- Repository: https://github.com/DiegoNogueiraDev/mcp-graph-workflow
- Academic affiliation: UNOPAR — Programa de Pós-Graduação em Engenharia
  da Computação

For academic collaboration, peer-review requests, or questions about citation,
please open an issue on the repository with the label `citation` or reach out
through the GitHub profile above.
