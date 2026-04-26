import { defineConfig } from "vitest/config";
import { cpus } from "node:os";
import path from "node:path";

// Cap parallelism to half the available CPUs (min 2). Many tests in this suite
// are timing-sensitive (perf SLOs, async timeouts, real git worktrees, FTS5
// rebuilds) — running with the default max worker count produces flaky failures
// on machines with 8+ cores. Forks pool gives stronger isolation than threads
// for tests that touch process-wide state. testTimeout also raised from 15s →
// 30s to absorb contention without per-test {timeout} overrides.
const MAX_WORKERS = Math.max(2, Math.floor(cpus().length / 2));

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30_000,
    pool: "forks",
    maxWorkers: MAX_WORKERS,
    // Two test surfaces with different DOM needs: server tests run in plain
    // node; dashboard tests need jsdom + RTL setup. Projects keeps node tests
    // fast (no jsdom overhead) while letting React tests live alongside.
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["src/tests/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        resolve: {
          // Mirror the dashboard's vite alias so `@/lib/...` imports resolve
          // the same way under vitest as they do at runtime.
          alias: {
            "@": path.resolve(__dirname, "./src/web/dashboard/src"),
          },
          dedupe: ["react", "react-dom"],
        },
        test: {
          name: "dashboard",
          include: ["src/web/dashboard/src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["./src/web/dashboard/src/test-setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: [
        "src/core/**",
        "src/api/**",
        "src/mcp/**",
        "src/cli/**",
        "src/web/dashboard/src/**",
      ],
      exclude: [
        "src/tests/**",
        "src/web/dashboard/src/**/*.test.{ts,tsx}",
        "src/web/dashboard/src/test-setup.ts",
        "src/web/dashboard/src/main.tsx",
        "src/web/dashboard/src/vite-env.d.ts",
      ],
      reporter: ["text", "html", "lcov"],
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
    },
  },
});
