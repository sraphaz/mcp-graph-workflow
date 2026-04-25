/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * In-memory session store + SQLite persistence for harness sessions.
 */

import type Database from "better-sqlite3";
import { generateId } from "../utils/id.js";
import type { CdpClient } from "./cdp-client.js";
import {
  HarnessSessionSchema,
  type HarnessSession,
} from "../../schemas/browser-harness.schema.js";
import { HarnessSessionNotFoundError } from "../utils/errors.js";

export interface ActiveSession {
  meta: HarnessSession;
  cdp: CdpClient;
}

export class SessionStore {
  private readonly active = new Map<string, ActiveSession>();

  constructor(private readonly db: Database.Database) {}

  register(cdp: CdpClient, endpoint: string, pid: number | null): HarnessSession {
    const id = generateId("bhsess");
    const startedAt = Date.now();
    this.db
      .prepare(
        `INSERT INTO bh_sessions (id, cdp_endpoint, pid, status, started_at, closed_at)
         VALUES (?, ?, ?, ?, ?, NULL)`,
      )
      .run(id, endpoint, pid, "ready", startedAt);
    const meta = HarnessSessionSchema.parse({
      id,
      cdpEndpoint: endpoint,
      pid,
      status: "ready",
      startedAt,
      closedAt: null,
    });
    this.active.set(id, { meta, cdp });
    return meta;
  }

  get(id: string): ActiveSession {
    const session = this.active.get(id);
    if (!session) throw new HarnessSessionNotFoundError(id);
    return session;
  }

  find(id: string): ActiveSession | null {
    return this.active.get(id) ?? null;
  }

  async close(id: string): Promise<void> {
    const session = this.active.get(id);
    if (!session) return;
    await session.cdp.close();
    this.active.delete(id);
    this.db
      .prepare("UPDATE bh_sessions SET status = ?, closed_at = ? WHERE id = ?")
      .run("closed", Date.now(), id);
  }

  list(): HarnessSession[] {
    return [...this.active.values()].map((s) => s.meta);
  }
}
