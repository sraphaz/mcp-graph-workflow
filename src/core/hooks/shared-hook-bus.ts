/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { GraphEventBus } from "../events/event-bus.js";
import { HookBus } from "./hook-bus.js";

let instance: HookBus | null = null;

/** getSharedHookBus — auto-generated description placeholder. */
export function getSharedHookBus(): HookBus {
  if (!instance) instance = new HookBus(new GraphEventBus());
  return instance;
}

/** setSharedHookBus — auto-generated description placeholder. */
export function setSharedHookBus(bus: HookBus | null): void {
  instance = bus;
}
