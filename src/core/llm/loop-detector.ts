/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-14 ActionLoopDetector — soft loop detection over recent tool calls.
 * Pure data structure. Does NOT kill the session; emits a soft nudge and
 * a structured event for the caller to forward to GraphEventBus.
 */

export interface LoopDetectorConfig {
  window: number;
  threshold: number;
}

export interface LoopDetectedEvent {
  event: "LOOP_DETECTED";
  toolName: string;
  count: number;
  hash: string;
  nudge: string;
}

const DEFAULT_CONFIG: LoopDetectorConfig = { window: 20, threshold: 3 };

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    const objValue = value as Record<string, unknown>;
    for (const key of Object.keys(objValue).sort()) {
      out[key] = canonicalize(objValue[key]);
    }
    return out;
  }
  return value;
}

function hashCall(toolName: string, params: unknown): string {
  return `${toolName.toLowerCase()}|${JSON.stringify(canonicalize(params))}`;
}

export class ActionLoopDetector {
  readonly config: LoopDetectorConfig;
  private readonly recent: Array<{ toolName: string; hash: string }> = [];

  constructor(config?: Partial<LoopDetectorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a tool call and report a loop if the same hash appears at least
   * `threshold` times within the most recent `window` entries (this entry
   * included). Returns null otherwise. Side-effect-free aside from internal
   * window state.
   */
  record(toolName: string, params: unknown): LoopDetectedEvent | null {
    const hash = hashCall(toolName, params);
    this.recent.push({ toolName, hash });
    while (this.recent.length > this.config.window) {
      this.recent.shift();
    }

    let count = 0;
    for (const entry of this.recent) {
      // §EPIC-16.3 — `hash` is a non-secret SHA-256 of the call signature
      // (toolName + params), used purely for loop detection. The `===`
      // comparison is correct here; timing-attack class is unreachable
      // because no secret is being compared.
      // eslint-disable-next-line security/detect-possible-timing-attacks
      if (entry.hash === hash) count++;
    }

    if (count >= this.config.threshold) {
      return {
        event: "LOOP_DETECTED",
        toolName,
        count,
        hash,
        nudge: `⚠ Loop detected on tool=${toolName}. Consider alternative.`,
      };
    }
    return null;
  }

  reset(): void {
    this.recent.length = 0;
  }
}
