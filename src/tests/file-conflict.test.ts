/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * Tests for file-overlap gate in enforceWipAndFileGates (Commit E).
 */

import { describe, it, expect, vi } from "vitest";
import { enforceWipAndFileGates, type WipGateOptions } from "../core/pipeline/wip-gate.js";
import { FileConflictError, LockConflictError } from "../core/utils/errors.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";
import type { LockManager } from "../core/store/lock-manager.js";

function makeStore(): SqliteStore {
  return {
    getNodesByStatus: vi.fn((_status: string) => []),
  } as unknown as SqliteStore;
}

function makeLockManager(overrides: Partial<{
  acquire: (resourceId: string, agentId: string, ttl: number) => { leaseToken: string };
  release: (token: string) => void;
  listActive: () => { resourceId: string; agentId: string; leaseToken: string; acquiredAt: string; expiresAt: string; resourceType: string }[];
}> = {}): LockManager {
  return {
    acquire: vi.fn((_resourceId: string, _agentId: string, _ttl: number) => ({
      leaseToken: `token-${Math.random()}`,
      resourceId: _resourceId,
      agentId: _agentId,
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    })),
    release: vi.fn((_token: string) => {}),
    listActive: vi.fn(() => []),
    ...overrides,
  } as unknown as LockManager;
}

function baseOpts(overrides: Partial<WipGateOptions> = {}): WipGateOptions {
  return {
    teamTask: true,
    wipLimit: 5,
    wipStrict: true,
    nodeId: "task-new",
    agentId: "agent-1",
    ...overrides,
  };
}

// ── AC: Tasks with empty touchedFiles bypass file gate ────────────────────

describe("file gate bypass", () => {
  it("should not acquire any file locks when touchedFiles is empty", () => {
    const lockManager = makeLockManager();
    const opts = baseOpts({ touchedFiles: [], lockManager });

    enforceWipAndFileGates(makeStore(), opts);

    expect((lockManager.acquire as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("should not acquire any file locks when touchedFiles is absent", () => {
    const lockManager = makeLockManager();
    const opts = baseOpts({ lockManager });

    enforceWipAndFileGates(makeStore(), opts);

    expect((lockManager.acquire as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});

// ── AC: wip-gate acquires file:* locks atomically ─────────────────────────

describe("file lock acquisition", () => {
  it("should acquire a file:* lock for each touchedFile", () => {
    const lockManager = makeLockManager();
    const files = ["src/foo.ts", "src/bar.ts"];
    const opts = baseOpts({ touchedFiles: files, lockManager });

    enforceWipAndFileGates(makeStore(), opts);

    const calls = (lockManager.acquire as ReturnType<typeof vi.fn>).mock.calls as [string, string, number][];
    const resourceIds = calls.map(c => c[0]);
    expect(resourceIds).toContain("file:src/foo.ts");
    expect(resourceIds).toContain("file:src/bar.ts");
  });

  it("should return fileLockTokens for successfully acquired file locks", () => {
    const lockManager = makeLockManager();
    const files = ["src/foo.ts"];
    const opts = baseOpts({ touchedFiles: files, lockManager });

    const result = enforceWipAndFileGates(makeStore(), opts);

    expect(Array.isArray(result.fileLockTokens)).toBe(true);
    expect(result.fileLockTokens!.length).toBe(1);
  });
});

// ── AC: Partial-acquire failure rolls back ────────────────────────────────

describe("rollback on partial failure", () => {
  it("should release already-acquired locks when a later file lock fails", () => {
    const releasedTokens: string[] = [];
    let callCount = 0;

    const lockManager = makeLockManager({
      acquire: vi.fn((_resourceId: string, _agentId: string, _ttl: number) => {
        callCount++;
        if (callCount === 2) {
          throw new LockConflictError({
            resourceId: _resourceId,
            owner: "agent-other",
            acquiredAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          });
        }
        return {
          leaseToken: `token-${callCount}`,
          resourceId: _resourceId,
          agentId: _agentId,
          acquiredAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        };
      }),
      release: vi.fn((token: string) => { releasedTokens.push(token); }),
    });

    const files = ["src/foo.ts", "src/conflict.ts", "src/bar.ts"];
    const opts = baseOpts({ touchedFiles: files, lockManager });

    expect(() => enforceWipAndFileGates(makeStore(), opts)).toThrow(FileConflictError);
    expect(releasedTokens).toContain("token-1");
  });
});

// ── AC: Throws FileConflictError with conflictingFiles + heldBy ───────────

describe("FileConflictError details", () => {
  it("should throw FileConflictError with conflictingFiles and heldBy populated", () => {
    const lockManager = makeLockManager({
      acquire: vi.fn((_resourceId: string, _agentId: string) => {
        throw new LockConflictError({
          resourceId: _resourceId,
          owner: "agent-other",
          acquiredAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        });
      }),
      release: vi.fn(),
    });

    const files = ["src/shared.ts"];
    const opts = baseOpts({ touchedFiles: files, lockManager, nodeId: "task-new" });

    try {
      enforceWipAndFileGates(makeStore(), opts);
      expect.fail("Should have thrown FileConflictError");
    } catch (err) {
      expect(err).toBeInstanceOf(FileConflictError);
      const conflictErr = err as FileConflictError;
      expect(conflictErr.details.nodeId).toBe("task-new");
      expect(conflictErr.details.conflictingFiles).toContain("src/shared.ts");
      expect(conflictErr.details.heldBy.length).toBeGreaterThan(0);
      expect(conflictErr.details.heldBy[0].agentId).toBe("agent-other");
    }
  });
});
