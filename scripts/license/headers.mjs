#!/usr/bin/env node
// scripts/license/headers.mjs
// Idempotent SPDX header stamping for mcp-graph source files.
//
// Usage:
//   node scripts/license/headers.mjs --check   exit 1 if any target file lacks the header
//   node scripts/license/headers.mjs --apply   insert the header into files that lack it
//
// Header source of truth: .license-header.tpl at repo root.
// Scope: src/**/*.{ts,tsx}, excluding node_modules, dist, coverage, *.d.ts.
// Shebang-aware: preserves `#!/usr/bin/env node` as line 1 when present.

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE_PATH = join(REPO_ROOT, '.license-header.tpl');
const SRC_DIR = join(REPO_ROOT, 'src');
const EXCLUDE_SEGMENTS = new Set(['node_modules', 'dist', 'coverage', '.next', '.vite']);
const TARGET_EXT = /\.(ts|tsx)$/;
const SKIP_SUFFIX = /\.d\.ts$/;
const SPDX_MARKER = 'SPDX-License-Identifier:';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (EXCLUDE_SEGMENTS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile() && TARGET_EXT.test(entry.name) && !SKIP_SUFFIX.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function buildBlockComment(rawTemplate) {
  const lines = rawTemplate.replace(/\s+$/, '').split('\n');
  const body = lines.map((l) => (l.length ? ` * ${l}` : ' *')).join('\n');
  return `/*!\n${body}\n */\n`;
}

async function processFile(path, block, { apply }) {
  const original = await readFile(path, 'utf8');
  if (original.includes(SPDX_MARKER)) return { path, status: 'skip' };

  let next;
  if (original.startsWith('#!')) {
    const nl = original.indexOf('\n');
    const shebang = nl === -1 ? original : original.slice(0, nl + 1);
    const rest = nl === -1 ? '' : original.slice(nl + 1);
    next = `${shebang}${block}${rest.startsWith('\n') ? rest : rest ? '\n' + rest : ''}`;
  } else {
    next = `${block}${original.startsWith('\n') ? original : '\n' + original}`;
  }

  if (apply) await writeFile(path, next, 'utf8');
  return { path, status: 'missing' };
}

async function main() {
  const mode = process.argv[2];
  if (mode !== '--check' && mode !== '--apply') {
    console.error('usage: node scripts/license/headers.mjs [--check|--apply]');
    process.exit(2);
  }

  const template = await readFile(TEMPLATE_PATH, 'utf8');
  const block = buildBlockComment(template);

  await stat(SRC_DIR);
  const files = await walk(SRC_DIR);

  const apply = mode === '--apply';
  const missing = [];
  for (const file of files) {
    const res = await processFile(file, block, { apply });
    if (res.status === 'missing') missing.push(relative(REPO_ROOT, file));
  }

  if (apply) {
    console.log(`Applied header to ${missing.length} file(s) out of ${files.length} scanned.`);
    process.exit(0);
  }

  if (missing.length === 0) {
    console.log(`All ${files.length} target file(s) carry the SPDX header.`);
    process.exit(0);
  }

  console.error(`Missing SPDX header in ${missing.length} file(s):`);
  for (const f of missing.slice(0, 50)) console.error(`  ${f}`);
  if (missing.length > 50) console.error(`  ... and ${missing.length - 50} more`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
