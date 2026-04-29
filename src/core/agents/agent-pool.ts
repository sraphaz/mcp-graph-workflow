/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.C1 — AgentPool: pre-spawned agents with FIFO acquire queue.
 *
 * Maintains a fixed-size pool of agent identifiers. acquire() returns the
 * next available agent or queues the caller until one is released. Optional
 * heartbeat replaces unhealthy agents in place.
 *
 * Pool size via env MCP_GRAPH_AGENT_POOL_SIZE (default 4).
 */

export const DEFAULT_POOL_SIZE = 4;
export const DEFAULT_ACQUIRE_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_HEARTBEAT_MS = 30_000;

export interface AgentLease {
  agentId: string;
  release: () => void;
}

export interface AgentPoolOptions {
  size?: number;
  spawn?: (index: number) => string;
  isHealthy?: (agentId: string) => boolean;
  heartbeatMs?: number;
}

interface Waiter {
  resolve: (lease: AgentLease) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class AgentPool {
  private readonly size: number;
  private readonly spawn: (index: number) => string;
  private readonly isHealthy: (agentId: string) => boolean;
  private readonly heartbeatMs: number;
  private readonly available: string[] = [];
  private readonly inUse = new Set<string>();
  private readonly waiters: Waiter[] = [];
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private agentCounter = 0;

  constructor(opts: AgentPoolOptions = {}) {
    this.size = opts.size ?? DEFAULT_POOL_SIZE;
    this.spawn = opts.spawn ?? ((i) => `agent-${i}`);
    this.isHealthy = opts.isHealthy ?? (() => true);
    this.heartbeatMs = opts.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
    for (let i = 0; i < this.size; i++) {
      this.available.push(this.spawn(this.agentCounter++));
    }
  }

  startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => this.replaceUnhealthy(), this.heartbeatMs);
    if (typeof this.heartbeatTimer.unref === "function") this.heartbeatTimer.unref();
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Force a heartbeat sweep; replaces unhealthy idle agents. Used in tests. */
  replaceUnhealthy(): number {
    let replaced = 0;
    for (let i = 0; i < this.available.length; i++) {
      if (!this.isHealthy(this.available[i])) {
        this.available[i] = this.spawn(this.agentCounter++);
        replaced++;
      }
    }
    return replaced;
  }

  acquire(timeoutMs: number = DEFAULT_ACQUIRE_TIMEOUT_MS): Promise<AgentLease> {
    const ready = this.available.shift();
    if (ready !== undefined) {
      this.inUse.add(ready);
      return Promise.resolve(this.makeLease(ready));
    }
    return new Promise<AgentLease>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.timer === timer);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new Error("agent-pool:acquire-timeout"));
      }, timeoutMs);
      if (typeof timer.unref === "function") timer.unref();
      this.waiters.push({ resolve, reject, timer });
    });
  }

  private makeLease(agentId: string): AgentLease {
    let released = false;
    return {
      agentId,
      release: () => {
        if (released) return;
        released = true;
        this.inUse.delete(agentId);
        const next = this.waiters.shift();
        if (next) {
          clearTimeout(next.timer);
          this.inUse.add(agentId);
          next.resolve(this.makeLease(agentId));
          return;
        }
        this.available.push(agentId);
      },
    };
  }

  stats(): { size: number; available: number; inUse: number; queued: number } {
    return {
      size: this.size,
      available: this.available.length,
      inUse: this.inUse.size,
      queued: this.waiters.length,
    };
  }

  drain(): void {
    this.stopHeartbeat();
    for (const w of this.waiters.splice(0)) {
      clearTimeout(w.timer);
      w.reject(new Error("agent-pool:drained"));
    }
  }
}
