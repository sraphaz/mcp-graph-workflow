# Preprint — MCP Graph Workflow

This directory hosts the working draft of the preprint that will be
submitted to **arXiv** (primary) and mirrored to **SSRN** (secondary).
The purpose of the preprint is to publicly anchor the methodology
contributions of this project — **Harnessability Score**,
**Anti-Vibe-Coding lifecycle**, **Task Readiness Score**, and the
**nine-phase PRD→Deploy pipeline** — with a citable, timestamped,
Google-Scholar-indexed reference before any corporate reimplementation
can claim priority.

## Files

- [`DRAFT.md`](DRAFT.md) — the current markdown draft (source of truth;
  rendered to LaTeX via pandoc for the arXiv submission).
- [`abstract.md`](abstract.md) — standalone abstract (150–250 words) —
  reviewed separately because arXiv asks for it in a specific form.
- [`outline.md`](outline.md) — section-by-section outline with target
  page counts, key points, and figure placeholders.
- [`bibliography.bib`](bibliography.bib) — references (INVEST, Martin
  Fowler fitness functions, Kent Beck XP, MCP spec, etc.).

## Target venue

- **arXiv:** category `cs.SE` (Software Engineering), secondary `cs.AI`.
- **Page target:** 12–15 pages (arXiv has no hard limit; this length
  signals research depth without looking padded).
- **License:** arXiv's `CC-BY-4.0` — consistent with the code's MIT
  grant. CC-BY requires attribution, which reinforces the authorship
  chain.

## Submission checklist

1. [ ] Draft content-complete in `DRAFT.md`
2. [ ] Bibliography cited (min 20 references, including INVEST,
      fitness functions, XP, MCP spec, agentic AI papers)
3. [ ] Figures: architecture diagram, 9-phase lifecycle, Harnessability
      radar, Task Readiness flowchart, daemon RSS benchmark chart
4. [ ] Convert to LaTeX via `pandoc DRAFT.md -o mcp-graph.tex`
5. [ ] Run `latexmk -pdf mcp-graph.tex` locally to verify it compiles
6. [ ] Create arXiv account linked to author's ORCID
7. [ ] Submit via https://arxiv.org/submit — endorsement may be
      required for first-time `cs.SE` submission; reach out to an
      UNOPAR professor already listed on arXiv as endorser
8. [ ] Fill the DOI into `CITATION.cff` under `identifiers:` after
      arXiv assigns one (arxiv:XXXX.XXXXX)
9. [ ] Update the BibTeX entry in the main README to cite the preprint
10. [ ] Mirror to SSRN at https://papers.ssrn.com/submit for a second
      indexed record

## Citation hooks already in place

This preprint, once public, becomes the canonical citation target.
Until then:

- `CITATION.cff` at the repo root is consumed by GitHub's "Cite this
  repository" button and most reference managers.
- `NOTICE.md` enumerates the original methodology contributions.
- `docs/architecture/adrs/ADR-001-model-router.md` documents the
  Model Router design decision.
- The README's "How to Cite" section provides a ready-to-paste BibTeX
  entry.

## Timeline

- **Week 1 — outline + abstract.** Two 2-hour sessions.
- **Week 2–3 — draft sections 1–4** (intro, background, methodology).
  Three to four 2-hour sessions.
- **Week 4 — draft sections 5–7** (evaluation, discussion, conclusion).
  Two 2-hour sessions.
- **Week 5 — figures + bibliography + polish.** One 3-hour session.
- **Week 6 — endorsement request + submission.**

Keep the cadence steady; the preprint does not need to wait for the
dissertation defense. Earlier publication = earlier priority date.
