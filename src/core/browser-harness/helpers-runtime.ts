/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Sandboxed execution of helper source via node:vm. Each helper is compiled
 * to an async function (cdp, args) => result and run inside a Context whose
 * globals are limited to { cdp, logger, console: <noop>, JSON, Promise,
 * setTimeout, clearTimeout }. No access to fs, child_process, process, or
 * dynamic require.
 */

import vm from "node:vm";
import type { CdpClient } from "./cdp-client.js";
import type { HelpersRegistry } from "./helpers-registry.js";
import { HelperNotFoundError, HarnessSafetyViolation } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "helpers-runtime.ts" });

type CompiledHelper = (
  cdp: CdpClient,
  args: Record<string, unknown>,
) => Promise<unknown>;

const SANDBOX_TIMEOUT_MS = 30_000;

export class HelpersRuntime {
  private readonly cache = new Map<string, { version: number; fn: CompiledHelper }>();

  constructor(private readonly registry: HelpersRegistry) {}

  async invoke(
    cdp: CdpClient,
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const helper = this.registry.find(name);
    if (!helper) throw new HelperNotFoundError(name);

    const cached = this.cache.get(name);
    let fn: CompiledHelper;
    if (cached && cached.version === helper.version) {
      fn = cached.fn;
    } else {
      fn = this.compile(name, helper.source);
      this.cache.set(name, { version: helper.version, fn });
    }

    return await Promise.race([
      Promise.resolve(fn(cdp, args)),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new HarnessSafetyViolation(
                "helper_timeout",
                `helper "${name}" exceeded ${SANDBOX_TIMEOUT_MS}ms`,
              ),
            ),
          SANDBOX_TIMEOUT_MS,
        ),
      ),
    ]);
  }

  /** Drop the cached compiled helper so the next call recompiles from source. */
  invalidate(name: string): void {
    this.cache.delete(name);
  }

  private compile(name: string, source: string): CompiledHelper {
    // Wrap the source in an IIFE that returns the helper function.
    // Source must evaluate to an arrow/function expression: e.g.
    //   "async (cdp, args) => { ... }"
    const wrapped = `(${source.trim()})`;

    let script: vm.Script;
    try {
      script = new vm.Script(wrapped, { filename: `bh-helper:${name}` });
    } catch (err) {
      throw new HarnessSafetyViolation(
        "helper_compile_error",
        `${name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const sandbox: Record<string, unknown> = {
      JSON,
      Promise,
      setTimeout,
      clearTimeout,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      Error,
      console: {
        log: (...args: unknown[]) => log.debug(`bh-helper:${name}`, { args: args.map(String) }),
        warn: (...args: unknown[]) => log.warn(`bh-helper:${name}`, { args: args.map(String) }),
        error: (...args: unknown[]) => log.warn(`bh-helper:${name}`, { args: args.map(String) }),
      },
    };
    const context = vm.createContext(sandbox, { name: `bh-helper-ctx:${name}` });
    const fn = script.runInContext(context, { timeout: 1_000 }) as CompiledHelper;
    if (typeof fn !== "function") {
      throw new HarnessSafetyViolation(
        "helper_not_a_function",
        `${name}: source did not evaluate to a function`,
      );
    }
    return fn;
  }
}
