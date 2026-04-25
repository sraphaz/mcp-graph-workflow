---
name: browser-harness/domain/github
description: Patterns for driving github.com through the browser harness.
triggers:
  - github
version: 1.0.0
---

# GitHub Domain Skill

## Common Selectors

- Sign in: `input[name="login"]`, `input[name="password"]`, `[type=submit]`
- Repo nav: `[data-tab-item="i0repo-content"]`
- Issue title: `.markdown-title`
- New issue: `a[href*="/issues/new"]`

## Patterns

- Always `wait_for("[data-react-helmet-async]")` after a navigation — GitHub
  is React-rendered and the DOM is empty for the first ~200ms.
- Authentication via OAuth requires a logged-in user-data-dir. The harness
  cannot perform interactive 2FA — fail fast and surface the prompt.
