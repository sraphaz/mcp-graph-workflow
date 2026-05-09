/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-sentrux-adoption — Task 2.5: Sentrux advisory check for finish-task.
 *
 * Calls session_end and returns a warned flag. Never throws, never blocks.
 * Replaces the feature-depth regression gate (which was Goodhart-vulnerable).
 */

import { createLogger } from "../utils/logger.js";
import type { SentruxMcpAdapter } from "../integrations/sentrux-mcp-adapter.js";

const log = createLogger({ layer: "core", source: "sentrux-advisory-check.ts" });

export interface SentruxAdvisoryResult {
  warned: boolean;
  message?: string;
}

export async function runSentruxAdvisoryCheck(
  adapter: SentruxMcpAdapter,
  sessionId: string | null,
): Promise<SentruxAdvisoryResult> {
  if (sessionId === null) {
    return { warned: false };
  }
  try {
    const result = await adapter.sessionEnd({ sessionId });
    if (result.issuesDelta > 0) {
      const message = `Sentrux: ${result.issuesDelta} new issue(s) introduced this session (advisory)`;
      log.warn("sentrux:advisory:degradation", { sessionId, issuesDelta: result.issuesDelta });
      return { warned: true, message };
    }
    return { warned: false };
  } catch (err) {
    log.warn("sentrux:advisory:unavailable", { error: String(err) });
    return { warned: false };
  }
}
