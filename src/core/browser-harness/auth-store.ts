/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Per-project auth store for browser-harness LLM providers.
 * File: <projectRoot>/workflow-graph/bh-auth.json (chmod 600, gitignored).
 * Falls back to environment variables when file is absent.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, unlinkSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { z } from "zod/v4";
import { ValidationError } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "auth-store.ts" });

export type LlmProvider = "anthropic" | "copilot";

const AuthProviderSchema = z.object({
  apiKey: z.string().min(16),
  model: z.string().optional(),
});

const AuthFileSchema = z.object({
  version: z.literal(1),
  providers: z
    .object({
      anthropic: AuthProviderSchema.optional(),
      copilot: AuthProviderSchema.optional(),
    })
    .default({}),
  preferredProvider: z.enum(["anthropic", "copilot"]).optional(),
  updatedAt: z.string(),
});

export type AuthFile = z.infer<typeof AuthFileSchema>;

export interface AuthSaveInput {
  provider: LlmProvider;
  apiKey: string;
  model?: string;
  /** If true, mark this provider as the preferred one. Auto-true when it's the only one. */
  preferred?: boolean;
}

export interface AuthProviderView {
  model?: string;
  fingerprint: string;
  source: "file" | "env";
}

export interface AuthView {
  authenticated: boolean;
  preferredProvider?: LlmProvider;
  providers: Partial<Record<LlmProvider, AuthProviderView>>;
}

const ENV_KEY_FOR: Record<LlmProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  copilot: "GITHUB_COPILOT_TOKEN",
};

const KEY_PATTERN: Record<LlmProvider, RegExp> = {
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
  copilot: /^(ghu_|gho_|ghp_|ghs_)[A-Za-z0-9]{20,}$/,
};

function fingerprint(key: string): string {
  if (key.length <= 8) return "***";
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

function assertValidKey(provider: LlmProvider, apiKey: string): void {
  if (!KEY_PATTERN[provider].test(apiKey)) {
    throw new ValidationError(`invalid ${provider} API key format`, []);
  }
}

export class AuthStore {
  private readonly filePath: string;

  constructor(projectRoot: string) {
    this.filePath = join(projectRoot, "workflow-graph", "bh-auth.json");
  }

  read(): AuthView {
    const file = this.readFile();
    const view: AuthView = { authenticated: false, providers: {} };

    if (file) {
      view.preferredProvider = file.preferredProvider;
      for (const pVar of ["anthropic", "copilot"] as const) {
        const entry = file.providers[pVar];
        if (entry) {
          view.providers[pVar] = {
            model: entry.model,
            fingerprint: fingerprint(entry.apiKey),
            source: "file",
          };
          view.authenticated = true;
        }
      }
    }

    // Env-var fallback for providers not in the file.
    for (const pVar of ["anthropic", "copilot"] as const) {
      if (view.providers[pVar]) continue;
      const raw = process.env[ENV_KEY_FOR[pVar]];
      if (raw && KEY_PATTERN[pVar].test(raw)) {
        view.providers[pVar] = { fingerprint: fingerprint(raw), source: "env" };
        view.authenticated = true;
        view.preferredProvider ??= pVar;
      }
    }

    return view;
  }

  getRawKey(provider: LlmProvider): string | undefined {
    const file = this.readFile();
    const fromFile = file?.providers[provider]?.apiKey;
    if (fromFile) return fromFile;
    const fromEnv = process.env[ENV_KEY_FOR[provider]];
    if (fromEnv && KEY_PATTERN[provider].test(fromEnv)) return fromEnv;
    return undefined;
  }

  save(input: AuthSaveInput): AuthView {
    assertValidKey(input.provider, input.apiKey);
    const current = this.readFile() ?? {
      version: 1 as const,
      providers: {},
      updatedAt: new Date().toISOString(),
    };
    const next: AuthFile = {
      version: 1,
      providers: { ...current.providers, [input.provider]: { apiKey: input.apiKey, model: input.model } },
      preferredProvider:
        input.preferred || !current.preferredProvider ? input.provider : current.preferredProvider,
      updatedAt: new Date().toISOString(),
    };
    this.writeFile(next);
    log.info("bh:auth:save", { provider: input.provider, fingerprint: fingerprint(input.apiKey) });
    return this.read();
  }

  removeProvider(provider: LlmProvider): AuthView {
    const current = this.readFile();
    if (!current) return this.read();
    const nextProviders = { ...current.providers };
    Reflect.deleteProperty(nextProviders, provider);
    const next: AuthFile = {
      version: 1,
      providers: nextProviders,
      preferredProvider:
        current.preferredProvider === provider ? firstKey(nextProviders) : current.preferredProvider,
      updatedAt: new Date().toISOString(),
    };
    if (Object.keys(nextProviders).length === 0) {
      this.clear();
      return this.read();
    }
    this.writeFile(next);
    return this.read();
  }

  clear(): void {
    if (existsSync(this.filePath)) {
      unlinkSync(this.filePath);
      log.info("bh:auth:clear", {});
    }
  }

  private readFile(): AuthFile | null {
    if (!existsSync(this.filePath)) return null;
    try {
      const raw = readFileSync(this.filePath, "utf8");
      return AuthFileSchema.parse(JSON.parse(raw));
    } catch (err) {
      log.warn("bh:auth:read_failed", { error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  private writeFile(data: AuthFile): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
    try {
      chmodSync(this.filePath, 0o600);
    } catch {
      // best-effort; platforms without chmod semantics (Windows) simply ignore.
    }
    if (process.platform !== "win32") {
      const mode = statSync(this.filePath).mode & 0o777;
      if (mode !== 0o600) {
        log.warn("bh:auth:mode_unexpected", { mode: mode.toString(8) });
      }
    }
  }
}

function firstKey(providers: AuthFile["providers"]): LlmProvider | undefined {
  for (const k of ["anthropic", "copilot"] as const) {
    if (providers[k]) return k;
  }
  return undefined;
}

/** Extra redaction pass for API responses — the canonical read() is already
 *  redacted, but this guards against accidental key leakage if callers
 *  JSON-serialise adjacent state. */
export function redactAuthView(view: AuthView): AuthView {
  return {
    authenticated: view.authenticated,
    preferredProvider: view.preferredProvider,
    providers: Object.fromEntries(
      Object.entries(view.providers).map(([k, v]) => [
        k,
        v ? { model: v.model, fingerprint: v.fingerprint, source: v.source } : v,
      ]),
    ) as AuthView["providers"],
  };
}
