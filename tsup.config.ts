/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * T2.4 — bundle the 5 published bin entries with tsup (esbuild under the
 * hood). Native modules and tree-sitter parsers must stay external; tsup
 * marks them as such so the bundle stays slim and Node resolves them at
 * runtime against the consumer's installed copies.
 */

import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "cli/index": "src/cli/index.ts",
    "mcp/stdio": "src/mcp/stdio.ts",
    "mcp/server": "src/mcp/server.ts",
    "mcp/daemon-entry": "src/mcp/daemon-entry.ts",
    "mcp/stdio-proxy": "src/mcp/stdio-proxy.ts",
  },
  outDir: "dist",
  format: ["esm"],
  target: "node20",
  platform: "node",
  bundle: true,
  splitting: false, // each bin is self-contained; no shared chunk
  sourcemap: false, // ~21MB total maps would 4× the tarball; dev uses tsx anyway
  clean: false, // copy-assets / dashboard outputs land here too — preserve
  dts: false, // .d.ts not shipped to bin consumers; tsc --noEmit covers types
  shims: true, // restore __dirname / __filename / require in ESM
  minify: false, // keep readable for debugging; size budget is tarball, not bundle bytes
  treeshake: true,
  external: [
    // Native bindings — must resolve at runtime against consumer's prebuilt
    "better-sqlite3",
    // Playwright ships browser binaries as a separate post-install
    "playwright",
    "playwright-core",
    /^@playwright\//,
    // WASM-based parser — bundling the WASM init breaks
    "web-tree-sitter",
    // Native tree-sitter language packages
    /^tree-sitter-/,
    // MCP SDK — keep as a peer-style external per AC; agents get a single
    // copy in their resolution chain
    "@modelcontextprotocol/sdk",
    /^@modelcontextprotocol\//,
    // Other native or large optional deps
    "intelephense",
    "typescript-language-server",
    "onnxruntime-node", // optional native dep loaded dynamically
  ],
  noExternal: [],
});
