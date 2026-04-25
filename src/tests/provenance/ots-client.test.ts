/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi } from "vitest";
import {
  OtsClient,
  type OtsHttpAdapter,
  type OtsReceipt,
} from "../../core/provenance/ots-client.js";
import { GraphEventBus } from "../../core/events/event-bus.js";

// Factory: minimal pending receipt from OTS
function makePendingReceipt(hash: string): OtsReceipt {
  return {
    hash,
    status: "pending",
    receiptData: Buffer.from("mock-ots-file").toString("base64"),
  };
}

// Factory: minimal confirmed receipt (upgraded)
function makeConfirmedReceipt(hash: string): OtsReceipt {
  return {
    hash,
    status: "confirmed",
    receiptData: Buffer.from("mock-ots-confirmed").toString("base64"),
    blockTimestamp: 1_700_000_000,
  };
}

// Factory: offline adapter
function makeOfflineAdapter(): OtsHttpAdapter {
  return {
    submit: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    upgrade: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
  };
}

// Factory: adapter that returns pending on submit, then confirms on upgrade
function makeOnlineAdapter(hash: string): OtsHttpAdapter {
  return {
    submit: vi.fn().mockResolvedValue(makePendingReceipt(hash)),
    upgrade: vi.fn().mockResolvedValue(makeConfirmedReceipt(hash)),
  };
}

describe("OtsClient", () => {
  const HASH = "a".repeat(64);

  describe("AC1 — submit returns pending receipt stored", () => {
    it("should return a receipt with status pending when OTS responds", async () => {
      const bus = new GraphEventBus();
      const adapter = makeOnlineAdapter(HASH);
      const client = new OtsClient(adapter, bus);

      const receipt = await client.submitHash(HASH);

      expect(receipt.hash).toBe(HASH);
      expect(receipt.status).toBe("pending");
      expect(receipt.receiptData).toBeTruthy();
    });

    it("should emit ots:submitted event after successful submission", async () => {
      const bus = new GraphEventBus();
      const adapter = makeOnlineAdapter(HASH);
      const client = new OtsClient(adapter, bus);
      const events: unknown[] = [];
      bus.on("ots:submitted", (e) => events.push(e));

      await client.submitHash(HASH);

      expect(events).toHaveLength(1);
      expect((events[0] as { payload: { hash: string } }).payload.hash).toBe(HASH);
    });

    it("should store the pending receipt internally", async () => {
      const bus = new GraphEventBus();
      const adapter = makeOnlineAdapter(HASH);
      const client = new OtsClient(adapter, bus);

      await client.submitHash(HASH);

      const stored = client.getReceipt(HASH);
      expect(stored).toBeDefined();
      expect(stored?.status).toBe("pending");
    });

    it("should not add to retry queue on successful submission", async () => {
      const bus = new GraphEventBus();
      const adapter = makeOnlineAdapter(HASH);
      const client = new OtsClient(adapter, bus);

      await client.submitHash(HASH);

      expect(client.retryQueueSize()).toBe(0);
    });
  });

  describe("AC2 — upgrade changes status to confirmed with block timestamp", () => {
    it("should update stored receipt to confirmed after upgrade", async () => {
      const bus = new GraphEventBus();
      const adapter = makeOnlineAdapter(HASH);
      const client = new OtsClient(adapter, bus);

      await client.submitHash(HASH);
      const confirmed = await client.upgradeReceipt(HASH);

      expect(confirmed.status).toBe("confirmed");
      expect(confirmed.blockTimestamp).toBeTypeOf("number");
    });

    it("should emit ots:confirmed event after upgrade", async () => {
      const bus = new GraphEventBus();
      const adapter = makeOnlineAdapter(HASH);
      const client = new OtsClient(adapter, bus);
      const events: unknown[] = [];
      bus.on("ots:confirmed", (e) => events.push(e));

      await client.submitHash(HASH);
      await client.upgradeReceipt(HASH);

      expect(events).toHaveLength(1);
      expect((events[0] as { payload: { blockTimestamp: number } }).payload.blockTimestamp).toBeTypeOf("number");
    });

    it("should update the internally stored receipt after upgrade", async () => {
      const bus = new GraphEventBus();
      const adapter = makeOnlineAdapter(HASH);
      const client = new OtsClient(adapter, bus);

      await client.submitHash(HASH);
      await client.upgradeReceipt(HASH);

      const stored = client.getReceipt(HASH);
      expect(stored?.status).toBe("confirmed");
      expect(stored?.blockTimestamp).toBeDefined();
    });

    it("should throw if upgrading a hash that was never submitted", async () => {
      const bus = new GraphEventBus();
      const adapter = makeOnlineAdapter(HASH);
      const client = new OtsClient(adapter, bus);

      await expect(client.upgradeReceipt(HASH)).rejects.toThrow();
    });
  });

  describe("AC3 — OTS offline: retry scheduled, event emitted, record preserved", () => {
    it("should add hash to retry queue when OTS is offline on submit", async () => {
      const bus = new GraphEventBus();
      const adapter = makeOfflineAdapter();
      const client = new OtsClient(adapter, bus);

      await client.submitHash(HASH);

      expect(client.retryQueueSize()).toBe(1);
    });

    it("should emit ots:retry_scheduled event when OTS is offline", async () => {
      const bus = new GraphEventBus();
      const adapter = makeOfflineAdapter();
      const client = new OtsClient(adapter, bus);
      const events: unknown[] = [];
      bus.on("ots:retry_scheduled", (e) => events.push(e));

      await client.submitHash(HASH);

      expect(events).toHaveLength(1);
      expect((events[0] as { payload: { hash: string } }).payload.hash).toBe(HASH);
    });

    it("should store receipt with retry_scheduled status when offline", async () => {
      const bus = new GraphEventBus();
      const adapter = makeOfflineAdapter();
      const client = new OtsClient(adapter, bus);

      await client.submitHash(HASH);

      const stored = client.getReceipt(HASH);
      expect(stored).toBeDefined();
      expect(stored?.status).toBe("retry_scheduled");
    });

    it("should not throw when OTS is offline — submit resolves with retry_scheduled receipt", async () => {
      const bus = new GraphEventBus();
      const adapter = makeOfflineAdapter();
      const client = new OtsClient(adapter, bus);

      const receipt = await client.submitHash(HASH);

      expect(receipt.status).toBe("retry_scheduled");
      expect(receipt.hash).toBe(HASH);
    });

    it("should flush retry queue and submit pending hashes when online", async () => {
      const bus = new GraphEventBus();
      const onlineAdapter = makeOnlineAdapter(HASH);
      const client = new OtsClient(makeOfflineAdapter(), bus);

      // Submit while offline — queued
      await client.submitHash(HASH);
      expect(client.retryQueueSize()).toBe(1);

      // Swap adapter to online and flush
      client.setAdapter(onlineAdapter);
      const flushed = await client.flushRetryQueue();

      expect(flushed).toBe(1);
      expect(client.retryQueueSize()).toBe(0);
      const stored = client.getReceipt(HASH);
      expect(stored?.status).toBe("pending");
    });

    it("should not duplicate queue entries for the same hash", async () => {
      const bus = new GraphEventBus();
      const adapter = makeOfflineAdapter();
      const client = new OtsClient(adapter, bus);

      await client.submitHash(HASH);
      await client.submitHash(HASH);

      expect(client.retryQueueSize()).toBe(1);
    });
  });
});
