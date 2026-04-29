/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 20 — A2A Direct Communication (E20.T02).
 * Tests for A2AMailbox: SQLite-backed ring buffer per recipient with ack flow.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { A2AMailbox } from "../core/swarm/a2a-mailbox.js";

describe("A2AMailbox (E20.T02)", () => {
  let db: Database.Database;
  let mailbox: A2AMailbox;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    mailbox = new A2AMailbox(db, { capacityPerRecipient: 3 });
  });

  afterEach(() => {
    db.close();
  });

  it("send persists message with status='pending' and generated id", () => {
    const m = mailbox.send({ from: "a", to: "b", body: { kind: "ping" } });
    expect(m.id).toBeTruthy();
    expect(m.from).toBe("a");
    expect(m.to).toBe("b");
    expect(m.body).toEqual({ kind: "ping" });
    expect(m.status).toBe("pending");
    expect(m.createdAt).toBeTruthy();
  });

  it("pendingFor returns oldest-first messages addressed to the agent", () => {
    mailbox.send({ from: "a", to: "b", body: 1 });
    mailbox.send({ from: "a", to: "b", body: 2 });
    mailbox.send({ from: "x", to: "y", body: 99 });
    const pending = mailbox.pendingFor("b");
    expect(pending.length).toBe(2);
    expect(pending[0]?.body).toBe(1);
    expect(pending[1]?.body).toBe(2);
  });

  it("recv marks oldest pending as delivered and returns it (FIFO)", () => {
    mailbox.send({ from: "a", to: "b", body: 1 });
    mailbox.send({ from: "a", to: "b", body: 2 });
    const m1 = mailbox.recv("b");
    expect(m1?.body).toBe(1);
    expect(m1?.status).toBe("delivered");
    const m2 = mailbox.recv("b");
    expect(m2?.body).toBe(2);
  });

  it("recv returns null when no pending messages", () => {
    expect(mailbox.recv("nobody")).toBeNull();
  });

  it("recv skips already-delivered/acked messages", () => {
    mailbox.send({ from: "a", to: "b", body: 1 });
    mailbox.recv("b");
    expect(mailbox.recv("b")).toBeNull();
  });

  it("ack transitions delivered → acked and stamps acked_at", () => {
    const sent = mailbox.send({ from: "a", to: "b", body: "x" });
    mailbox.recv("b");
    const acked = mailbox.ack(sent.id);
    expect(acked).not.toBeNull();
    expect(acked?.status).toBe("acked");
    expect(acked?.ackedAt).toBeTruthy();
  });

  it("ack returns null when id missing", () => {
    expect(mailbox.ack("does-not-exist")).toBeNull();
  });

  it("ring buffer evicts oldest pending message per recipient when capacity reached", () => {
    mailbox.send({ from: "a", to: "b", body: 1 });
    mailbox.send({ from: "a", to: "b", body: 2 });
    mailbox.send({ from: "a", to: "b", body: 3 });
    mailbox.send({ from: "a", to: "b", body: 4 }); // 1 must be evicted
    const pending = mailbox.pendingFor("b");
    expect(pending.length).toBe(3);
    expect(pending.map((m) => m.body)).toEqual([2, 3, 4]);
  });

  it("ring buffer is per-recipient (capacity is not global)", () => {
    for (let i = 0; i < 4; i++) {
      mailbox.send({ from: "a", to: "b", body: i });
      mailbox.send({ from: "a", to: "c", body: i });
    }
    expect(mailbox.pendingFor("b").length).toBe(3);
    expect(mailbox.pendingFor("c").length).toBe(3);
  });

  it("totalCount counts all rows across statuses", () => {
    mailbox.send({ from: "a", to: "b", body: 1 });
    mailbox.send({ from: "a", to: "b", body: 2 });
    mailbox.recv("b");
    expect(mailbox.totalCount()).toBe(2);
  });
});
