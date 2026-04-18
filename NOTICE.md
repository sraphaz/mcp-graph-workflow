# NOTICE

## Authorship

**MCP Graph Workflow** is the intellectual work of **Diego Lima Nogueira de Paula**.

The architecture, methodology, and implementation of this system originated as
part of ongoing Master's research in Computer Engineering at **UNOPAR —
Universidade Norte do Paraná** (Postgraduate Program in Computer Engineering,
in progress as of 2026).

The source code is released under the MIT License (see [`LICENSE`](LICENSE)),
which grants broad permissions for use, modification, and redistribution. This
notice documents the authorship chain and does **not** reduce or alter the
rights granted by the MIT License.

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

The MIT License permits reuse without citation in purely commercial or
operational contexts. Citation is requested as a matter of academic honesty
and scientific integrity whenever the system is discussed, evaluated, or
extended in research or public-facing technical work.

## Provenance of Ideas

The following concepts and design choices are original contributions of this
work and are documented in the author's research:

- PRD-to-graph conversion as the primary authoring surface for agentic
  software engineering.
- The **Harnessability Score** composite metric (seven-dimension evaluation
  of agent readiness) — see `docs/guides/HARNESS-ENGINEERING.md`.
- The **Task Readiness Score** + Model Router pattern for routing atomic
  work to smaller, cheaper language models — see
  `src/core/planner/task-readiness-score.ts`.
- The nine-phase lifecycle with deterministic phase gates, as encoded in
  `src/core/pipeline/` and `docs/reference/LIFECYCLE.md`.
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

## Contact

- GitHub: https://github.com/DiegoNogueiraDev
- Repository: https://github.com/DiegoNogueiraDev/mcp-graph-workflow
- Academic affiliation: UNOPAR — Programa de Pós-Graduação em Engenharia
  da Computação

For academic collaboration, peer-review requests, or questions about citation,
please open an issue on the repository with the label `citation` or reach out
through the GitHub profile above.
