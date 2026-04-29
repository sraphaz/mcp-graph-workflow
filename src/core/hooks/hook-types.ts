/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { z } from "zod/v4";
import { McpGraphError } from "../utils/errors.js";

export class HookTimeoutError extends McpGraphError {
  constructor(public readonly handlerId: string, public readonly timeoutMs: number) {
    super(`Hook handler "${handlerId}" exceeded timeout of ${timeoutMs}ms`);
    this.name = "HookTimeoutError";
  }
}

export class HookCircuitOpenError extends McpGraphError {
  constructor(public readonly handlerId: string) {
    super(`Hook handler "${handlerId}" is disabled (circuit open)`);
    this.name = "HookCircuitOpenError";
  }
}

export const HOOK_CHANNELS = [
  "session:start",
  "session:end",
  "agent:pre-spawn",
  "agent:post-spawn",
  "task:pre-execute",
  "task:post-complete",
  "task:error",
  "tool:pre-call",
  "tool:post-call",
  "memory:pre-store",
  "memory:post-store",
  "swarm:consensus-reached",
  "approval:required",
  // §EPIC-20.T01 — A2A Direct Communication: agent peer-to-peer message bus.
  "agent:p2p-send",
  "agent:p2p-receive",
  "agent:p2p-ack",
] as const;

export const HookChannelSchema = z.enum(HOOK_CHANNELS);

export type HookChannel = z.infer<typeof HookChannelSchema>;

export const HookEventSchema = z.object({
  channel: HookChannelSchema,
  timestamp: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

export type HookEvent = z.infer<typeof HookEventSchema>;

export const HookHandlerSchema = z.custom<(event: HookEvent) => Promise<void>>(
  (fn) =>
    typeof fn === "function" &&
    (fn as { constructor: { name: string } }).constructor.name === "AsyncFunction",
  { error: "HookHandler must be an async function" },
);

export type HookHandler = (event: HookEvent) => Promise<void>;

export const HookRegistrationSchema = z.object({
  id: z.string().min(1),
  channel: HookChannelSchema,
  handler: HookHandlerSchema,
  priority: z.number().int().default(0),
});

export type HookRegistration = z.infer<typeof HookRegistrationSchema>;
