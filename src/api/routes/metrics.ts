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
 * §Story-10 / node_10c0b0434d5e — GET /metrics
 * JSON (default) or Prometheus text (?format=prometheus).
 */

import { Router } from "express";
import { getSnapshot, type MetricsSnapshot } from "../../core/observability/metrics.js";

function toPrometheusName(name: string): string {
  return name.replace(/[.-]/g, "_");
}

function toPrometheusText(snapshot: MetricsSnapshot): string {
  const lines: string[] = [];

  for (const [name, value] of Object.entries(snapshot.counters)) {
    const pname = toPrometheusName(name);
    lines.push(`# TYPE ${pname} counter`);
    lines.push(`${pname} ${value}`);
  }

  for (const [name, stats] of Object.entries(snapshot.histograms)) {
    const pname = toPrometheusName(name);
    lines.push(`# TYPE ${pname} summary`);
    lines.push(`${pname}_p50 ${stats.p50}`);
    lines.push(`${pname}_p95 ${stats.p95}`);
    lines.push(`${pname}_p99 ${stats.p99}`);
    lines.push(`${pname}_count ${stats.count}`);
  }

  return lines.join("\n") + "\n";
}

export function createMetricsRouter(): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const snapshot = getSnapshot();
    if (req.query["format"] === "prometheus") {
      res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
      res.send(toPrometheusText(snapshot));
      return;
    }
    res.json(snapshot);
  });

  return router;
}
