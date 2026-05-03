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
 * B22 (P2): analyze(mode: "feature_depth") deve falhar com erro acionável
 * quando o cwd não tem fontes Go (ou go.mod) — não com stderr vazio.
 *
 * Repro:
 *   $ cd /tmp/empty-project && mcp-graph init
 *   $ echo '{...analyze feature_depth...}' | mcp-graph-stdio
 *   {"ok":false,"mode":"feature_depth","error":"go_run_failed","exitCode":null,"stderr":""}
 *   [WARN] tool:analyze:feature_depth:go_failed exitCode="null"
 *
 * Go binary IS instalado (1.26.1). A falha é silenciosa — exit code null,
 * stderr vazio — e o user fica sem saber se é problema de Go ausente,
 * cwd errado, ou bug.
 *
 * Esperado: error code = "no_source_files" com hint "feature_depth requires
 * a source tree at <path> (go files, ts files)" antes de invocar go run.
 *
 * Source: mcp-graph notebook node_3741375074f4.
 */

import { describe, it, expect } from "vitest";

describe.skip("B22 — analyze feature_depth opaque go_run_failed (recon, no fix yet)", () => {
  it("returns no_source_files with actionable hint when cwd has no source tree", () => {
    expect(true).toBe(true);
  });
});
