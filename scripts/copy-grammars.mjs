#!/usr/bin/env node

/**
 * Copy tree-sitter grammar .wasm files into dist/wasm/ so they ship
 * with the published npm package. This lets us drop the tree-sitter-*
 * native bindings from optionalDependencies (they only carry conflicting
 * `tree-sitter` core peers and add zero value at runtime — we use
 * web-tree-sitter via WASM).
 *
 * Source: node_modules/<pkg>/<wasm> (tree-sitter-* are devDependencies).
 * Target: dist/wasm/<wasm> (resolved by treesitter-manager.ts strategy 0).
 *
 * Missing grammars are warned, not fatal — the runtime degrades gracefully.
 */

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const GRAMMARS = [
  { pkg: "tree-sitter-python",  wasm: "tree-sitter-python.wasm" },
  { pkg: "tree-sitter-go",      wasm: "tree-sitter-go.wasm" },
  { pkg: "tree-sitter-rust",    wasm: "tree-sitter-rust.wasm" },
  { pkg: "tree-sitter-java",    wasm: "tree-sitter-java.wasm" },
  { pkg: "tree-sitter-c",       wasm: "tree-sitter-c.wasm" },
  { pkg: "tree-sitter-cpp",     wasm: "tree-sitter-cpp.wasm" },
  { pkg: "tree-sitter-ruby",    wasm: "tree-sitter-ruby.wasm" },
  { pkg: "tree-sitter-php",     wasm: "tree-sitter-php.wasm" },
  { pkg: "tree-sitter-c-sharp", wasm: "tree-sitter-c_sharp.wasm" },
  { pkg: "tree-sitter-lua",     wasm: "tree-sitter-lua.wasm" },
  { pkg: "tree-sitter-kotlin",  wasm: "tree-sitter-kotlin.wasm" },
  { pkg: "tree-sitter-swift",   wasm: "tree-sitter-swift.wasm" },
];

const targetDir = join("dist", "wasm");
mkdirSync(targetDir, { recursive: true });

const copied = [];
const missing = [];

for (const { pkg, wasm } of GRAMMARS) {
  let pkgDir;
  try {
    pkgDir = dirname(require.resolve(`${pkg}/package.json`));
  } catch {
    missing.push(`${pkg} (package not installed)`);
    continue;
  }

  const src = join(pkgDir, wasm);
  if (!existsSync(src)) {
    missing.push(`${pkg} (no ${wasm} in package)`);
    continue;
  }

  cpSync(src, join(targetDir, wasm));
  copied.push(wasm);
}

console.log(`copy-grammars: bundled ${copied.length}/${GRAMMARS.length} grammars → ${targetDir}`);
if (missing.length > 0) {
  console.warn(`copy-grammars: skipped — ${missing.join(", ")}`);
}

// Fail the build if zero grammars were bundled — shipping an empty
// dist/wasm/ would silently strip tree-sitter language support from the
// published package. Better to fail early than fail in production.
if (copied.length === 0) {
  console.error(
    "copy-grammars: FATAL — no grammars copied. " +
      "Run `npm install` to fetch tree-sitter-* devDependencies before building.",
  );
  process.exit(1);
}
