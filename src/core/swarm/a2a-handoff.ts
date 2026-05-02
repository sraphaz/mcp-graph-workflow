/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 20 — A2A Direct Communication.
 * Opt-in handoff helper for swarm-coordinator. When `enabled` is true the
 * handoff sends through A2AMailbox and emits agent:p2p-send. When disabled
 * the call is a no-op so callers fall back to graph-state handoff (T04).
 */

import type { A2AMailbox } from "./a2a-mailbox.js";
import type { HookEvent } from "../hooks/hook-types.js";
import { now } from "../utils/time.js";

export type HookEmitter = (event: HookEvent) => void | Promise<void>;

export interface CreateA2AHandoffOptions {
  mailbox: A2AMailbox;
  hookEmit: HookEmitter;
  enabled: boolean;
}

export interface A2AHandoffInput<T = unknown> {
  from: string;
  to: string;
  body: T;
}

export interface A2AHandoffResult {
  delivered: boolean;
  messageId: string | null;
}

/** createA2AHandoff — auto-generated description placeholder. */
export function createA2AHandoff(opts: CreateA2AHandoffOptions) {
  return async <T = unknown>(input: A2AHandoffInput<T>): Promise<A2AHandoffResult> => {
    if (!opts.enabled) {
      return { delivered: false, messageId: null };
    }
    const message = opts.mailbox.send(input);
    await opts.hookEmit({
      channel: "agent:p2p-send",
      timestamp: now(),
      payload: {
        from: input.from,
        to: input.to,
        messageId: message.id,
      },
    });
    return { delivered: true, messageId: message.id };
  };
}
