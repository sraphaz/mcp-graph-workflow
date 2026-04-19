export default {
  extends: ["@commitlint/config-conventional"],
  // Ignore release automation commits that are created through the GitHub API
  // and therefore cannot carry a Signed-off-by trailer. release-please-bot
  // and dependabot both fit this pattern.
  ignores: [
    (message) =>
      /^chore\(master\): release /.test(message) ||
      /^chore\(deps(-dev)?\): bump /.test(message) ||
      /Signed-off-by:\s+dependabot\[bot\]/.test(message) ||
      /Signed-off-by:\s+renovate\[bot\]/.test(message),
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
