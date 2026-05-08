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
 * Health Check — validates connectivity with configured Siebel environments.
 */

import { createLogger } from "../utils/logger.js";
import type { SiebelEnvironment } from "../../schemas/siebel.schema.js";

const log = createLogger({ layer: "core", source: "health-check.ts" });

export type HealthStatus = "online" | "offline" | "degraded";

export interface HealthCheckOptions {
  timeoutMs?: number;
}

export interface HealthCheckResult {
  environmentName: string;
  url: string;
  status: HealthStatus;
  responseTimeMs: number;
  error?: string;
  checkedAt: string;
}

/**
 * Check connectivity with a Siebel environment.
 */
export async function checkEnvironmentHealth(
  env: SiebelEnvironment,
  options?: HealthCheckOptions,
): Promise<HealthCheckResult> {
  const timeoutMs = options?.timeoutMs ?? 10000;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(env.url, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timer);
    const responseTimeMs = Date.now() - start;

    const status: HealthStatus = response.ok ? "online" : "degraded";

    log.info("Health check complete", {
      environment: env.name,
      status,
      responseTime: String(responseTimeMs),
    });

    return {
      environmentName: env.name,
      url: env.url,
      status,
      responseTimeMs,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);

    log.warn("Health check failed", {
      environment: env.name,
      error,
    });

    return {
      environmentName: env.name,
      url: env.url,
      status: "offline",
      responseTimeMs,
      error,
      checkedAt: new Date().toISOString(),
    };
  }
}
