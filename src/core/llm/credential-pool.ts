/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-credential-pool — Task 1.2: CredentialPool with round-robin + circuit breaker.
 */

import type { CredentialPoolEntry } from "./credential-pool-schema.js";

const CIRCUIT_OPEN_THRESHOLD = 3;

export class CredentialPool {
  private readonly entries = new Map<string, CredentialPoolEntry[]>();

  addEntries(providerId: string, entries: CredentialPoolEntry[]): void {
    this.entries.set(providerId, entries);
  }

  selectEntry(providerId: string): CredentialPoolEntry | null {
    const all = this.entries.get(providerId);
    if (!all || all.length === 0) return null;

    const now = Date.now();
    const healthy = all
      .filter((e) => e.errorCount < CIRCUIT_OPEN_THRESHOLD)
      .filter((e) => e.kind !== "oauth_bearer" || (e.expiresAt !== undefined && e.expiresAt > now))
      .sort((a, b) => (a.lastUsedAt ?? 0) - (b.lastUsedAt ?? 0));

    if (healthy.length === 0) return null;

    const selected = healthy[0]!;
    selected.lastUsedAt = now;
    return selected;
  }

  markSuccess(entry: CredentialPoolEntry): void {
    entry.errorCount = 0;
    entry.lastUsedAt = Date.now();
  }

  markError(entry: CredentialPoolEntry, _err: Error): void {
    entry.errorCount += 1;
    entry.lastErrorAt = Date.now();
  }
}
