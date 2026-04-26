/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Local-first invariant guard (ADR-0057).
 *
 * mcp-graph is 100% local-first: zero mandatory SaaS dependencies, zero
 * phone-home telemetry. Every external integration is opt-in and lives
 * behind an explicit user action (CLI command, env var, config file).
 *
 * This test is a **structural guard** — it does NOT exercise behavior.
 * It scans `package.json` and the production source tree for known
 * SaaS-client packages and well-known SaaS API URLs. Any match outside
 * the explicit allow-list fails the test.
 *
 * If a match is a false positive, prefer adding the file to
 * `OPT_IN_FILES` (with a comment explaining why) over weakening the
 * pattern. If a new opt-in is genuinely needed, the new entry must be
 * documented in ADR-0057 first.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const SRC_ROOT = join(REPO_ROOT, "src");
const PACKAGE_JSON_PATH = join(REPO_ROOT, "package.json");

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * Packages that ship a SaaS client and would tie mcp-graph to a remote
 * service. Banned outright from `dependencies` and `optionalDependencies`.
 * `devDependencies` is allowed (test/CI tooling can use anything).
 */
const BANNED_RUNTIME_PACKAGES: readonly RegExp[] = [
  // Telemetry / analytics
  /^posthog/,
  /^@sentry\//,
  /^mixpanel/,
  /^amplitude/,
  /^@datadog\//,
  // Auth SaaS
  /^auth0$/,
  /^@auth0\//,
  /^@clerk\//,
  // BaaS / cloud DB
  /^@supabase\//,
  /^firebase/,
  /^@firebase\//,
  /^mongodb$/,
  /^@planetscale\//,
  /^@neondatabase\//,
  // Cloud storage / SDKs
  /^@aws-sdk\//,
  /^aws-sdk$/,
  /^cloudinary/,
  /^@google-cloud\//,
  /^@azure\/storage-/,
  // LLM SaaS clients (we wrap these via fetch in opt-in modules)
  /^@anthropic-ai\/sdk$/,
  /^openai$/,
  /^cohere/,
  /^@mistralai\//,
  /^@google\/generative-ai$/,
  // Email / SMS / payment SaaS
  /^@sendgrid\//,
  /^twilio$/,
  /^mailgun/,
  /^stripe$/,
];

/**
 * String literals that look like SaaS API endpoints. Any occurrence in
 * production source outside `OPT_IN_FILES` fails the test.
 */
const BANNED_URL_PATTERNS: readonly RegExp[] = [
  /https:\/\/api\.anthropic\.com/i,
  /https:\/\/api\.openai\.com/i,
  /https:\/\/api\.cohere\.[a-z]+/i,
  /https:\/\/api\.mistral\.ai/i,
  /https:\/\/generativelanguage\.googleapis\.com/i,
  /https:\/\/api\.githubcopilot\.com/i,
  /https:\/\/[^\s"']*\.posthog\.com/i,
  /https:\/\/[^\s"']*\.sentry\.io/i,
  /https:\/\/api\.mixpanel\.com/i,
  /https:\/\/api\.amplitude\.com/i,
];

/**
 * Files where SaaS-style URLs are intentionally allowed because they
 * sit behind explicit opt-in (env var, config, or CLI command). Each
 * entry must correspond to a documented opt-in in ADR-0057.
 */
const OPT_IN_FILES: readonly string[] = [
  // LLM client — only invoked when user provides credentials in
  // workflow-graph/bh-auth.json or env vars (ANTHROPIC_API_KEY etc.).
  "src/core/browser-harness/llm-client.ts",
  // Hugging Face model download — only invoked via `mcp-graph install-neural`.
  "src/core/rag/onnx-embeddings.ts",
  // Tools dir is not under src/ but listed for clarity.
];

/**
 * Directories under src/ that are exempt from URL scanning.
 * Tests and dashboard builds are not production runtime.
 */
const SCAN_EXEMPT_DIRS: readonly string[] = [
  "src/tests",
  "src/web/dashboard/dist",
  "src/web/dashboard/node_modules",
];

function listTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(REPO_ROOT, full);
    if (SCAN_EXEMPT_DIRS.some((p) => rel === p || rel.startsWith(`${p}/`))) {
      continue;
    }
    const st = statSync(full);
    if (st.isDirectory()) {
      listTsFiles(full, acc);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

function stripComments(source: string): string {
  // Remove block comments and line comments. Crude but sufficient — we
  // do not need an AST; we only want to avoid false positives where
  // banned URLs appear in JSDoc or `//` notes.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("local-first invariant — package.json (ADR-0057)", () => {
  const pkg: PackageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));

  for (const block of ["dependencies", "optionalDependencies", "peerDependencies"] as const) {
    it(`no banned SaaS-client package appears in ${block}`, () => {
      const names = Object.keys(pkg[block] ?? {});
      const offenders = names.filter((name) =>
        BANNED_RUNTIME_PACKAGES.some((re) => re.test(name)),
      );
      expect(offenders).toEqual([]);
    });
  }
});

describe("local-first invariant — source URLs (ADR-0057)", () => {
  const files = listTsFiles(SRC_ROOT);

  it(`covers a meaningful number of source files (${files.length} found)`, () => {
    // Sanity: if scanning collapses to zero we'd silently accept everything.
    expect(files.length).toBeGreaterThan(50);
  });

  it("no banned SaaS URL appears in production source outside the opt-in allow-list", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = relative(REPO_ROOT, file);
      if (OPT_IN_FILES.includes(rel)) {
        continue;
      }
      const stripped = stripComments(readFileSync(file, "utf8"));
      for (const re of BANNED_URL_PATTERNS) {
        const match = re.exec(stripped);
        if (match !== null) {
          offenders.push(`${rel}: matches ${re.source}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
