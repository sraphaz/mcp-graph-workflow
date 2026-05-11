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
 * §Story-9 — Health check observability events
 *
 * AC1: runDoctor emits one logger.event per check result
 * AC2: every event carries action='health.check' and category='health'
 * AC3: outcome maps ok→success, non-ok→failure
 * AC4: context carries { check: result.name }
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as loggerModule from "../../core/utils/logger.js";
import { runDoctor } from "../../core/doctor/doctor-runner.js";

describe("doctor health-check events", () => {
  let eventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    eventSpy = vi.spyOn(loggerModule.logger, "event");
  });

  afterEach(() => {
    eventSpy.mockRestore();
  });

  it("AC1: emits one event per check result", async () => {
    const report = await runDoctor("/tmp");
    expect(eventSpy).toHaveBeenCalledTimes(report.checks.length);
  });

  it("AC2: every event has action=health.check and category=health", async () => {
    await runDoctor("/tmp");
    for (const call of eventSpy.mock.calls) {
      const evt = call[0] as { action: string; category: string };
      expect(evt.action).toBe("health.check");
      expect(evt.category).toBe("health");
    }
  });

  it("AC3: ok level maps to outcome=success, non-ok to outcome=failure", async () => {
    const report = await runDoctor("/tmp");
    const calls = eventSpy.mock.calls as Array<[{ outcome: string }, string, unknown]>;
    expect(calls.length).toBe(report.checks.length);
    for (let i = 0; i < report.checks.length; i++) {
      const expected = report.checks[i].level === "ok" ? "success" : "failure";
      expect(calls[i][0].outcome).toBe(expected);
    }
  });

  it("AC4: context carries check name", async () => {
    const report = await runDoctor("/tmp");
    const calls = eventSpy.mock.calls as Array<[unknown, string, { check: string } | undefined]>;
    for (let i = 0; i < report.checks.length; i++) {
      expect(calls[i][2]?.check).toBe(report.checks[i].name);
    }
  });
});
