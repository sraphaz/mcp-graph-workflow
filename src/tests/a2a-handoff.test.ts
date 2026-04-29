/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 20 — A2A Direct Communication (E20.T03).
 * Tests for the opt-in A2A handoff helper used by swarm-coordinator.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { A2AMailbox } from "../core/swarm/a2a-mailbox.js";
import {
  createA2AHandoff,
  type HookEmitter,
} from "../core/swarm/a2a-handoff.js";
import type { HookEvent } from "../core/hooks/hook-types.js";

function captureEmitter(): { fn: HookEmitter; events: HookEvent[] } {
  const events: HookEvent[] = [];
  return {
    fn: (e) => {
      events.push(e);
    },
    events,
  };
}

describe("A2A handoff helper (E20.T03)", () => {
  let db: Database.Database;
  let mailbox: A2AMailbox;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    mailbox = new A2AMailbox(db);
  });

  afterEach(() => {
    db.close();
  });

  it("handoff with A2A enabled persists message + emits agent:p2p-send", async () => {
    const cap = captureEmitter();
    const handoff = createA2AHandoff({ mailbox, hookEmit: cap.fn, enabled: true });

    const result = await handoff({ from: "queen", to: "w1", body: { task: "go" } });

    expect(result.delivered).toBe(true);
    expect(result.messageId).toBeTruthy();
    expect(mailbox.pendingFor("w1").length).toBe(1);
    expect(cap.events.length).toBe(1);
    expect(cap.events[0]?.channel).toBe("agent:p2p-send");
    expect(cap.events[0]?.payload).toMatchObject({ from: "queen", to: "w1" });
  });

  it("handoff with A2A disabled does not persist nor emit (single-agent fallback)", async () => {
    const cap = captureEmitter();
    const handoff = createA2AHandoff({ mailbox, hookEmit: cap.fn, enabled: false });

    const result = await handoff({ from: "queen", to: "w1", body: "x" });

    expect(result.delivered).toBe(false);
    expect(result.messageId).toBeNull();
    expect(mailbox.pendingFor("w1").length).toBe(0);
    expect(cap.events).toEqual([]);
  });

  it("recipient can recv + ack the message round-trip", async () => {
    const cap = captureEmitter();
    const handoff = createA2AHandoff({ mailbox, hookEmit: cap.fn, enabled: true });
    const sent = await handoff({ from: "queen", to: "w1", body: { task: "compute" } });

    const incoming = mailbox.recv<{ task: string }>("w1");
    expect(incoming?.id).toBe(sent.messageId);
    expect(incoming?.body).toEqual({ task: "compute" });
    expect(incoming?.status).toBe("delivered");

    const acked = mailbox.ack(sent.messageId!);
    expect(acked?.status).toBe("acked");
  });

  it("handoff propagates error from mailbox.send (no swallow)", async () => {
    const broken = {
      send: () => {
        throw new Error("disk full");
      },
    } as unknown as A2AMailbox;
    const cap = captureEmitter();
    const handoff = createA2AHandoff({ mailbox: broken, hookEmit: cap.fn, enabled: true });
    await expect(handoff({ from: "a", to: "b", body: 1 })).rejects.toThrow(/disk full/);
    expect(cap.events).toEqual([]);
  });

  it("handoff hook event includes timestamp", async () => {
    const cap = captureEmitter();
    const handoff = createA2AHandoff({ mailbox, hookEmit: cap.fn, enabled: true });
    await handoff({ from: "a", to: "b", body: 1 });
    expect(cap.events[0]?.timestamp).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
