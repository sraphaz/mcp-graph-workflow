/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  llmInputSchema,
  LLM_READ_ONLY_ACTIONS,
  buildLlmHandler,
} from "../mcp/tools/llm.js";

describe("MCP tool `llm` — skeleton (D.1a)", () => {
  it("inputSchema rejects unknown action", () => {
    const result = llmInputSchema.safeParse({ action: "foo" });
    expect(result.success).toBe(false);
  });

  it("inputSchema accepts action='list_models'", () => {
    const result = llmInputSchema.safeParse({ action: "list_models" });
    expect(result.success).toBe(true);
  });

  it("inputSchema accepts all 4 actions: generate, list_models, budget_status, proxy_status", () => {
    for (const action of ["generate", "list_models", "budget_status", "proxy_status"]) {
      const result = llmInputSchema.safeParse({ action });
      expect(result.success, `action=${action}`).toBe(true);
    }
  });

  it("LLM_READ_ONLY_ACTIONS contains list_models, budget_status, proxy_status — not generate", () => {
    expect(LLM_READ_ONLY_ACTIONS.has("list_models")).toBe(true);
    expect(LLM_READ_ONLY_ACTIONS.has("budget_status")).toBe(true);
    expect(LLM_READ_ONLY_ACTIONS.has("proxy_status")).toBe(true);
    expect(LLM_READ_ONLY_ACTIONS.has("generate")).toBe(false);
  });

  it("handler dispatches all 4 actions (no 'not implemented' fallthrough — D.1b/D.1c wired)", async () => {
    const handler = buildLlmHandler({});
    for (const action of ["generate", "list_models", "budget_status", "proxy_status"] as const) {
      const res = await handler({ action });
      // proxy_status is the only one that succeeds without a gateway (placeholder).
      if (action === "proxy_status") {
        expect(res.isError).toBeFalsy();
      } else {
        expect(res.isError).toBe(true);
      }
    }
  });
});
