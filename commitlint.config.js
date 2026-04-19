export default {
  extends: ["@commitlint/config-conventional"],
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
