/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * `mcp-graph browser-harness` — thin CLI wrapper. Real work is delegated
 * to core/browser-harness/.
 */

import { Command } from "commander";
import {
  CdpClient,
  HelpersRegistry,
  HelpersRuntime,
  SelfHealService,
  SessionStore,
  seedBuiltInHelpers,
  loadGuardrail,
} from "../../core/browser-harness/index.js";
import { logger } from "../../core/utils/logger.js";

async function withStore<T>(fn: (store: import("../../core/store/sqlite-store.js").SqliteStore) => Promise<T>): Promise<T> {
  const { SqliteStore } = await import("../../core/store/sqlite-store.js");
  const store = SqliteStore.open(process.cwd());
  try {
    return await fn(store);
  } finally {
    store.close();
  }
}

function parseKv(items: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const itemValue of items) {
    const eq = itemValue.indexOf("=");
    if (eq === -1) continue;
    const k = itemValue.slice(0, eq);
    const raw = itemValue.slice(eq + 1);
    try { out[k] = JSON.parse(raw); } catch { out[k] = raw; }
  }
  return out;
}

/** browserHarnessCommand — auto-generated description placeholder. */
export function browserHarnessCommand(): Command {
  const cmd = new Command("browser-harness")
    .alias("bh")
    .description("Browser harness — direct CDP control with self-healing helpers");

  cmd.command("connect <endpoint>")
    .description("Connect to a running Chrome via its CDP websocket and print sessionId")
    .action(async (endpoint: string) => {
      await withStore(async (store) => {
        const db = store.getDb();
        const registry = new HelpersRegistry(db);
        seedBuiltInHelpers(registry);
        const sessions = new SessionStore(db);
        const cdp = new CdpClient({ endpoint });
        await cdp.connect();
        const meta = sessions.register(cdp, endpoint, null);
         
        process.stdout.write(JSON.stringify({ ok: true, sessionId: meta.id, endpoint: meta.cdpEndpoint }) + "\n");
      });
    });

  cmd.command("list-helpers")
    .description("List registered helpers (built-in + agent-added)")
    .option("-o, --origin <origin>", "Filter by origin: builtin | agent")
    .action(async (opts: { origin?: "builtin" | "agent" }) => {
      await withStore(async (store) => {
        const registry = new HelpersRegistry(store.getDb());
        seedBuiltInHelpers(registry);
        const list = registry.list(opts.origin);
        process.stdout.write(JSON.stringify({ ok: true, helpers: list }, null, 2) + "\n");
      });
    });

  cmd.command("call <name>")
    .description("Invoke a helper on an active session")
    .requiredOption("-s, --session <sessionId>", "Active session id")
    .option("-a, --arg <kv...>", "Argument key=value pairs (JSON values supported)", [])
    .action(async (name: string, opts: { session: string; arg: string[] }) => {
      await withStore(async (store) => {
        const registry = new HelpersRegistry(store.getDb());
        const runtime = new HelpersRuntime(registry);
        const selfHeal = new SelfHealService(store.getDb(), registry, runtime);
        void selfHeal;
        const sessions = new SessionStore(store.getDb());
        const session = sessions.find(opts.session);
        if (!session) {
          logger.error("bh:cli:call:no-session", { id: opts.session });
          process.stdout.write(JSON.stringify({ ok: false, error: "no active session — use 'connect' first in the same process" }) + "\n");
          return;
        }
        const resultValue = await runtime.invoke(session.cdp, name, parseKv(opts.arg));
        process.stdout.write(JSON.stringify({ ok: true, resultValue }) + "\n");
      });
    });

  cmd.command("guardrail")
    .description("Print the active guardrail (parsed from SKILL.md)")
    .action(() => {
      const gVar = loadGuardrail();
      process.stdout.write(JSON.stringify(gVar, null, 2) + "\n");
    });

  return cmd;
}
