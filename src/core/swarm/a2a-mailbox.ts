/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 20 — A2A Direct Communication.
 * SQLite-backed agent-to-agent mailbox. Ring buffer per recipient: when
 * capacity is reached, the oldest pending message is evicted to make room.
 *
 * Status flow:  pending → delivered → acked.
 *
 * COURIER ONLY: this is not authoritative. Real decisions still write
 * to the graph; the mailbox just avoids round-tripping context through SQLite
 * reads (§EPIC-20 design notes).
 */

import type Database from "better-sqlite3";
import { now } from "../utils/time.js";
import { generateId } from "../utils/id.js";

export type A2AStatus = "pending" | "delivered" | "acked";

export interface A2AMessage<T = unknown> {
  id: string;
  from: string;
  to: string;
  body: T;
  status: A2AStatus;
  createdAt: string;
  deliveredAt?: string;
  ackedAt?: string;
}

export interface A2AMailboxOptions {
  /** Max pending+delivered rows kept per recipient. Oldest pending is evicted on overflow. Default 64. */
  capacityPerRecipient?: number;
}

export interface A2ASendInput<T = unknown> {
  from: string;
  to: string;
  body: T;
}

interface MailboxRow {
  id: string;
  from_agent: string;
  to_agent: string;
  body: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  acked_at: string | null;
}

function rowToMessage<T>(row: MailboxRow): A2AMessage<T> {
  return {
    id: row.id,
    from: row.from_agent,
    to: row.to_agent,
    body: JSON.parse(row.body) as T,
    status: row.status as A2AStatus,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at ?? undefined,
    ackedAt: row.acked_at ?? undefined,
  };
}

export class A2AMailbox {
  private db: Database.Database;
  private capacity: number;

  constructor(db: Database.Database, opts: A2AMailboxOptions = {}) {
    this.db = db;
    this.capacity = opts.capacityPerRecipient ?? 100;
  }

  send<T = unknown>(input: A2ASendInput<T>): A2AMessage<T> {
    const id = generateId("a2a");
    const createdAt = now();
    this.db
      .prepare(
        `INSERT INTO a2a_mailbox (id, from_agent, to_agent, body, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
      )
      .run(id, input.from, input.to, JSON.stringify(input.body), createdAt);

    this.evictIfOverCapacity(input.to);

    return {
      id,
      from: input.from,
      to: input.to,
      body: input.body,
      status: "pending",
      createdAt,
    };
  }

  pendingFor<T = unknown>(toAgent: string): A2AMessage<T>[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM a2a_mailbox
         WHERE to_agent = ? AND status = 'pending'
         ORDER BY created_at ASC, rowid ASC`,
      )
      .all(toAgent) as MailboxRow[];
    return rows.map(rowToMessage<T>);
  }

  recv<T = unknown>(toAgent: string): A2AMessage<T> | null {
    const row = this.db
      .prepare(
        `SELECT * FROM a2a_mailbox
         WHERE to_agent = ? AND status = 'pending'
         ORDER BY created_at ASC, rowid ASC
         LIMIT 1`,
      )
      .get(toAgent) as MailboxRow | undefined;
    if (!row) return null;

    const deliveredAt = now();
    this.db
      .prepare(
        `UPDATE a2a_mailbox SET status = 'delivered', delivered_at = ? WHERE id = ?`,
      )
      .run(deliveredAt, row.id);
    return rowToMessage<T>({ ...row, status: "delivered", delivered_at: deliveredAt });
  }

  ack<T = unknown>(messageId: string): A2AMessage<T> | null {
    const ackedAt = now();
    const resultValue = this.db
      .prepare(`UPDATE a2a_mailbox SET status = 'acked', acked_at = ? WHERE id = ?`)
      .run(ackedAt, messageId);
    if (resultValue.changes === 0) return null;
    const row = this.db
      .prepare(`SELECT * FROM a2a_mailbox WHERE id = ?`)
      .get(messageId) as MailboxRow | undefined;
    return row ? rowToMessage<T>(row) : null;
  }

  totalCount(): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS n FROM a2a_mailbox`).get() as { n: number };
    return row.n;
  }

  private evictIfOverCapacity(toAgent: string): void {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM a2a_mailbox
         WHERE to_agent = ? AND status IN ('pending', 'delivered')`,
      )
      .get(toAgent) as { n: number };
    const overflow = row.n - this.capacity;
    if (overflow <= 0) return;

    // Evict oldest pending messages first; never drop delivered (they may be
    // mid-handoff). If only delivered exist, do not evict.
    this.db
      .prepare(
        `DELETE FROM a2a_mailbox
         WHERE id IN (
           SELECT id FROM a2a_mailbox
           WHERE to_agent = ? AND status = 'pending'
           ORDER BY created_at ASC, rowid ASC
           LIMIT ?
         )`,
      )
      .run(toAgent, overflow);
  }
}
