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
 * Types for the `mcp-graph doctor` diagnostic command.
 */

export type CheckLevel = "ok" | "warning" | "error";

export interface CheckResult {
  name: string;
  level: CheckLevel;
  message: string;
  suggestion?: string;
}

export interface DoctorReport {
  checks: CheckResult[];
  summary: { ok: number; warning: number; error: number };
  passed: boolean;
}
