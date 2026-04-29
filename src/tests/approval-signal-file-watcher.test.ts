/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { waitForApproval, ApprovalTimeoutError } from "../core/approval/signal-file-watcher.js";

/** Fake readFile: returns null (not found) for `callsBefore` calls, then returns the given content. */
function makeReader(callsBefore: number, content: string | null = '{"approved":true}') {
  let calls = 0;
  return (_path: string): string | null => {
    calls++;
    return calls > callsBefore ? content : null;
  };
}

/** Fake clock that advances by `stepMs` per call. */
function makeClock(stepMs: number): () => number {
  let t = 0;
  return () => (t += stepMs);
}

/** Instant sleep (does not actually wait). */
async function noSleep(_ms: number): Promise<void> { /* no-op */ }

describe("waitForApproval() — signal file watcher", () => {
  it("resolves immediately when the signal file already exists with {approved:true}", async () => {
    await expect(
      waitForApproval({
        taskId: "task-1",
        readFile: makeReader(0),
        nowFn: makeClock(10),
        sleep: noSleep,
      }),
    ).resolves.toBeUndefined();
  });

  it("resolves after the file appears on the 3rd poll", async () => {
    await expect(
      waitForApproval({
        taskId: "task-2",
        readFile: makeReader(2),
        nowFn: makeClock(10),
        sleep: noSleep,
        intervalMs: 100,
      }),
    ).resolves.toBeUndefined();
  });

  it("polls at the configured interval (default 500ms)", async () => {
    const sleepCalls: number[] = [];
    await waitForApproval({
      taskId: "task-3",
      readFile: makeReader(2),  // resolves on 3rd read
      nowFn: makeClock(10),
      sleep: async (ms: number) => { sleepCalls.push(ms); },
      intervalMs: 500,
    });
    expect(sleepCalls.length).toBeGreaterThanOrEqual(2);
    expect(sleepCalls.every((ms) => ms === 500)).toBe(true);
  });

  it("uses 500ms as the default polling interval", async () => {
    const sleepCalls: number[] = [];
    await waitForApproval({
      taskId: "task-4",
      readFile: makeReader(1),
      nowFn: makeClock(10),
      sleep: async (ms: number) => { sleepCalls.push(ms); },
    });
    expect(sleepCalls.every((ms) => ms === 500)).toBe(true);
  });

  it("throws ApprovalTimeoutError after timeout with no signal file", async () => {
    await expect(
      waitForApproval({
        taskId: "task-5",
        readFile: () => null,
        nowFn: makeClock(1000),   // each call advances 1s
        sleep: noSleep,
        intervalMs: 100,
        timeoutMs: 3000,           // 3s timeout; 1s steps → 3 polls then timeout
      }),
    ).rejects.toBeInstanceOf(ApprovalTimeoutError);
  });

  it("ApprovalTimeoutError includes the taskId in its message", async () => {
    const err = await waitForApproval({
      taskId: "task-abc",
      readFile: () => null,
      nowFn: makeClock(400_000),
      sleep: noSleep,
      timeoutMs: 100,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApprovalTimeoutError);
    expect((err as Error).message).toContain("task-abc");
  });

  it("timeout default is 5 minutes (300_000ms)", async () => {
    // Uses real DEFAULT_TIMEOUT_MS constant — just checks it's 5min
    const { DEFAULT_TIMEOUT_MS } = await import("../core/approval/signal-file-watcher.js");
    expect(DEFAULT_TIMEOUT_MS).toBe(300_000);
  });

  it("ignores files that don't have {approved:true}", async () => {
    let reads = 0;
    const reader = (_path: string): string | null => {
      reads++;
      if (reads === 1) return '{"approved":false}';
      if (reads === 2) return '{"status":"pending"}';
      return '{"approved":true}';
    };
    await expect(
      waitForApproval({
        taskId: "task-6",
        readFile: reader,
        nowFn: makeClock(10),
        sleep: noSleep,
        intervalMs: 100,
      }),
    ).resolves.toBeUndefined();
    expect(reads).toBe(3);
  });

  it("signal file path is .workflow-approvals/<taskId>.json", async () => {
    const paths: string[] = [];
    await waitForApproval({
      taskId: "my-task-id",
      readFile: (p: string) => { paths.push(p); return '{"approved":true}'; },
      nowFn: makeClock(10),
      sleep: noSleep,
    });
    expect(paths[0]).toMatch(/\.workflow-approvals[/\\]my-task-id\.json$/);
  });
});
