#!/usr/bin/env node
// scripts/preflight.mjs
// Local CI mirror — runs the same gates CI runs, in the same order,
// before the user pushes. The pre-push husky hook calls this script.
//
// Purpose: any PR that passes preflight does not surprise on CI.
// Each step prefixes its label, fails fast, and prints a clear hint
// for how to fix.

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_TESTS = process.env.MCP_GRAPH_PREFLIGHT_SKIP_TESTS === '1';
const SKIP_COMMITLINT = process.env.MCP_GRAPH_PREFLIGHT_SKIP_COMMITLINT === '1';

const steps = [
  {
    label: 'typecheck',
    cmd: 'npm',
    args: ['run', 'typecheck'],
    hint: 'fix the TS errors above',
  },
  {
    label: 'lint',
    cmd: 'npm',
    args: ['run', 'lint'],
    hint: 'fix or `eslint-disable-next-line` with §-cite for the warning above',
  },
  {
    label: 'spdx',
    cmd: 'node',
    args: ['scripts/license/headers.mjs', '--check'],
    hint: 'run `node scripts/license/headers.mjs --apply` to auto-stamp',
  },
  {
    label: 'commitlint',
    cmd: 'sh',
    args: ['-c', 'npx --no -- commitlint --from origin/master --to HEAD'],
    skip: SKIP_COMMITLINT,
    skipReason: 'MCP_GRAPH_PREFLIGHT_SKIP_COMMITLINT=1',
    hint: 'amend each flagged commit with a valid type prefix and `Signed-off-by`',
  },
  {
    label: 'tests',
    cmd: 'npx',
    args: ['vitest', 'run', '--reporter=dot'],
    skip: SKIP_TESTS,
    skipReason: 'MCP_GRAPH_PREFLIGHT_SKIP_TESTS=1',
    hint: 'fix the failing tests above; locally `npm test` reproduces',
  },
];

function run(step) {
  return new Promise((resolveStep) => {
    if (step.skip) {
      console.log(`[33m[skip] ${step.label} (${step.skipReason})[0m`);
      resolveStep({ ok: true, skipped: true });
      return;
    }
    const t0 = Date.now();
    const child = spawn(step.cmd, step.args, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: process.env,
    });
    child.on('exit', (code) => {
      const ms = Date.now() - t0;
      resolveStep({ ok: code === 0, code, ms });
    });
    child.on('error', (err) => {
      resolveStep({ ok: false, code: -1, err: err.message, ms: Date.now() - t0 });
    });
  });
}

async function main() {
  // Sanity: husky pre-push runs from a worktree that should already have node_modules.
  if (!existsSync(resolve(REPO_ROOT, 'node_modules'))) {
    console.error('[31m[preflight] node_modules missing — run `npm install` first[0m');
    process.exit(1);
  }

  console.log('[1m[preflight] running CI-mirror gates locally[0m');
  const t0 = Date.now();
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    process.stdout.write(`[36m[${i + 1}/${steps.length}] ${step.label}...[0m\n`);
    const result = await run(step);
    if (!result.ok) {
      console.error(
        `[31m[FAIL] step ${i + 1} (${step.label}) — exit ${result.code}[0m\n` +
          `[33mhint: ${step.hint}[0m\n` +
          `[2mbypass with --no-verify if you really need to push (CI will likely fail).[0m`,
      );
      process.exit(1);
    }
    if (!result.skipped) {
      console.log(`[32m[ok] ${step.label} in ${result.ms}ms[0m`);
    }
  }
  const total = Date.now() - t0;
  console.log(`[32m[1m[OK] preflight passed in ${total}ms[0m`);
}

main().catch((err) => {
  console.error('[31m[preflight] crashed:', err, '[0m');
  process.exit(1);
});
