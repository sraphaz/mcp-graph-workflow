/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-PROXY — bearer token generation + rotation.
 * Pure crypto + decision module. CLI orchestration (file read/write +
 * 0600 chmod) lives in the proxy CLI; tests stay deterministic.
 */

import { randomBytes, randomFillSync } from "node:crypto";

export const BEARER_BYTES = 32;
export const BEARER_PREFIX = "mcpg_";
export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export interface BearerToken {
  token: string;
  createdAtMs: number;
  expiresAtMs?: number;
}

export interface BearerStore {
  active: BearerToken;
  previous?: BearerToken;
}

/** Generate a cryptographically-random bearer with a stable prefix. */
export function generateBearer(now: number = Date.now(), ttlMs?: number): BearerToken {
  const buf = randomBytes(BEARER_BYTES);
  const token = `${BEARER_PREFIX}${buf.toString("base64url")}`;
  const result: BearerToken = { token, createdAtMs: now };
  if (ttlMs !== undefined && ttlMs > 0) {
    result.expiresAtMs = now + ttlMs;
  }
  return result;
}

export function isExpired(token: BearerToken, now: number = Date.now()): boolean {
  if (token.expiresAtMs === undefined) return false;
  return now >= token.expiresAtMs;
}

/**
 * Produce a new store: active becomes the freshly generated token; the
 * old active moves to `previous` (single grace-period slot — useful for
 * in-flight requests during rotation).
 */
export function rotateBearer(
  currentStore: BearerStore | undefined,
  now: number = Date.now(),
  ttlMs?: number,
): BearerStore {
  const fresh = generateBearer(now, ttlMs);
  if (!currentStore) return { active: fresh };
  return { active: fresh, previous: currentStore.active };
}

/** Constant-time-ish equality (no early return on length mismatch beyond size). */
export function tokenMatches(received: string, store: BearerStore | undefined): boolean {
  if (!store || !received) return false;
  const candidates = [store.active.token];
  if (store.previous) candidates.push(store.previous.token);
  for (const candidate of candidates) {
    if (constantTimeEquals(received, candidate)) return true;
  }
  return false;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Force-fill provided buffer with random bytes (used for testing entropy). */
export function fillRandom(buf: Uint8Array): void {
  randomFillSync(buf);
}
