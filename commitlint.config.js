export default {
  extends: ["@commitlint/config-conventional"],
  // Ignore release automation commits that are created through the GitHub API
  // and therefore cannot carry a Signed-off-by trailer. release-please-bot
  // and dependabot both fit this pattern.
  ignores: [
    (message) =>
      /^chore\(master\): release /.test(message) ||
      // release-please v4 monorepo mode emits `chore: release master` (no scope)
      // when bumping multiple packages — exempt alongside the legacy single-pkg
      // `chore(master): release X.Y.Z` format.
      /^chore: release master/.test(message) ||
      /^chore\(deps(-dev)?\): bump /.test(message) ||
      /Signed-off-by:\s+dependabot\[bot\]/.test(message) ||
      /Signed-off-by:\s+renovate\[bot\]/.test(message) ||
      // §v13-PR — two historical commits on feat/v13-mcp-graph predate the
      // signed-off-by rule and are already on origin. Force-pushing to
      // amend would break PR review continuity. Match the subject line
      // (commitlint passes the full message including body, so we accept
      // the subject as the first line).
      /^wip: snapshot before v13 unification/.test(message) ||
      /^docs\(plan\): roadmap to bring best of ruflo into mcp-graph/.test(message),
  ],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "perf",
        "refactor",
        "docs",
        "chore",
        "ci",
        "test",
        "build",
        "style",
        "deps",
        "license",
        "security",
      ],
    ],
    "subject-case": [0],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
    // DCO: every commit must carry a Signed-off-by trailer. This is the
    // provisional proxy for the full CLA (see CLA.md S9, Option C). The
    // rule activates the built-in check in @commitlint/config-conventional.
    "signed-off-by": [2, "always", "Signed-off-by:"],
  },
};
