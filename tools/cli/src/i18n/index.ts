/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * i18n: minimal lookup-table-based translator for user-facing CLI text.
 *
 * Scope:
 *   - command descriptions, help text, error messages
 *   - Ink card labels, success cards, hint lines in next-steps lists
 *
 * Out of scope (always English):
 *   - log entries (tooling parity — `mg log --json` is consumed by scripts)
 *   - JSON output keys (script stability)
 *   - code identifiers, file paths, node IDs
 *
 * Resolution order at runtime (first wins):
 *   1. `--lang <code>` flag (one-shot, no persist)
 *   2. `MG_LANG` env var
 *   3. persisted user config (~/.mcp-graph/config.json)
 *   4. `$LANG` env var (e.g. "pt_BR.UTF-8" → "pt-br")
 *   5. "en" default
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { en } from "./en.js";
import { ptBr } from "./pt-br.js";

export type LangCode = "en" | "pt-br";

export const SUPPORTED_LANGS: readonly LangCode[] = ["en", "pt-br"];

const DICTIONARIES: Record<LangCode, Record<string, string>> = {
  en,
  "pt-br": ptBr,
};

let activeLang: LangCode | null = null;

export function configPath(): string {
  return join(homedir(), ".mcp-graph", "config.json");
}

export function readPersistedLang(): LangCode | null {
  try {
    if (!existsSync(configPath())) return null;
    const raw = JSON.parse(readFileSync(configPath(), "utf8")) as {
      lang?: string;
    };
    if (raw.lang && SUPPORTED_LANGS.includes(raw.lang as LangCode)) {
      return raw.lang as LangCode;
    }
  } catch {
    // unreadable / invalid — fall through
  }
  return null;
}

export function persistLang(lang: LangCode): void {
  const path = configPath();
  let existing: Record<string, unknown> = {};
  try {
    if (existsSync(path)) {
      existing = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    }
  } catch {
    // start fresh
  }
  const next = { ...existing, lang };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export function detectLangFromEnv(): LangCode | null {
  const fromMg = process.env.MG_LANG;
  if (fromMg && SUPPORTED_LANGS.includes(fromMg as LangCode)) {
    return fromMg as LangCode;
  }
  const fromLocale = process.env.LANG;
  if (fromLocale) {
    const head = fromLocale.toLowerCase().split(".")[0];
    if (head.startsWith("pt_br") || head === "pt-br" || head === "pt") {
      return "pt-br";
    }
    if (head.startsWith("en")) {
      return "en";
    }
  }
  return null;
}

export interface ResolveLangOptions {
  /** From `--lang <code>` flag — highest priority. */
  readonly cliFlag?: string;
}

export function resolveLang(opts: ResolveLangOptions = {}): LangCode {
  if (opts.cliFlag && SUPPORTED_LANGS.includes(opts.cliFlag as LangCode)) {
    return opts.cliFlag as LangCode;
  }
  if (process.env.MG_LANG && SUPPORTED_LANGS.includes(process.env.MG_LANG as LangCode)) {
    return process.env.MG_LANG as LangCode;
  }
  const persisted = readPersistedLang();
  if (persisted) return persisted;
  const fromEnv = detectLangFromEnv();
  if (fromEnv) return fromEnv;
  return "en";
}

export function setActiveLang(lang: LangCode): void {
  activeLang = lang;
}

export function getActiveLang(): LangCode {
  return activeLang ?? "en";
}

export function resetActiveLangForTests(): void {
  activeLang = null;
}

/**
 * Translate a key with optional `{var}` interpolation.
 *
 *   t("init.success")                      → "✔ mcp-graph initialized"
 *   t("next.startHint", { id: "abc" })     → "▸ start it: mg start abc"
 *
 * Falls back to English if a key is missing in the active language.
 * Falls back to the literal key if missing in both — never crashes.
 */
export function t(
  key: string,
  vars: Record<string, string | number> = {},
): string {
  const lang = getActiveLang();
  const dict = DICTIONARIES[lang];
  const fallback = DICTIONARIES.en;
  const template = dict[key] ?? fallback[key] ?? key;
  return interpolate(template, vars);
}

function interpolate(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  );
}
