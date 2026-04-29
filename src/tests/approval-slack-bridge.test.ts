/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T12 — approval-slack-bridge tests.
 */

import { describe, it, expect } from "vitest";
import {
  buildSlackPayload,
  postApprovalToSlack,
  isApprovalSlackDisabled,
  APPROVAL_SLACK_TIMEOUT_MS,
} from "../core/hooks/approval-slack-bridge.js";

describe("approval-slack-bridge (E21.T12)", () => {
  it("APPROVAL_SLACK_TIMEOUT_MS = 5s", () => {
    expect(APPROVAL_SLACK_TIMEOUT_MS).toBe(5000);
  });

  it("buildSlackPayload includes tool, severity, reason in fields", () => {
    const p = buildSlackPayload({
      tool: "delete_node",
      severity: "high",
      reason: "destructive op",
      nodeId: "n1",
    });
    expect(p.text).toContain("Approval required");
    expect(p.text).toContain("delete_node");
    expect(p.attachments).toHaveLength(1);
    const titles = p.attachments[0].fields.map((f) => f.title);
    expect(titles).toContain("Tool");
    expect(titles).toContain("Severity");
    expect(titles).toContain("Reason");
    expect(titles).toContain("Node");
  });

  it("buildSlackPayload color reflects severity", () => {
    expect(buildSlackPayload({ tool: "x", severity: "low", reason: "r" }).attachments[0].color)
      .toBe("#2eb886");
    expect(buildSlackPayload({ tool: "x", severity: "critical", reason: "r" }).attachments[0].color)
      .toBe("#9b1c31");
  });

  it("postApprovalToSlack returns no_webhook when SLACK_WEBHOOK_URL unset", async () => {
    const r = await postApprovalToSlack(
      { tool: "x", severity: "low", reason: "r" },
      { env: {} as NodeJS.ProcessEnv },
    );
    expect(r.posted).toBe(false);
    expect(r.reason).toBe("no_webhook");
  });

  it("postApprovalToSlack returns disabled when toggle off", async () => {
    const r = await postApprovalToSlack(
      { tool: "x", severity: "low", reason: "r" },
      {
        env: { SLACK_WEBHOOK_URL: "https://hooks.slack.com/x", MCP_GRAPH_APPROVAL_SLACK: "off" } as NodeJS.ProcessEnv,
      },
    );
    expect(r.posted).toBe(false);
    expect(r.reason).toBe("disabled");
  });

  it("postApprovalToSlack returns ok when fetch returns 200", async () => {
    let received: { url: string; body: unknown } | undefined;
    const fakeFetch = async (url: string, init: { body?: string }) => {
      received = { url, body: JSON.parse(init.body ?? "{}") };
      return { ok: true, status: 200 } as Response;
    };
    const r = await postApprovalToSlack(
      { tool: "x", severity: "high", reason: "r", nodeId: "n1" },
      {
        env: { SLACK_WEBHOOK_URL: "https://hooks.slack.com/x" } as NodeJS.ProcessEnv,
        fetch: fakeFetch as unknown as typeof fetch,
      },
    );
    expect(r.posted).toBe(true);
    expect(r.reason).toBe("ok");
    expect(r.status).toBe(200);
    expect(received?.url).toBe("https://hooks.slack.com/x");
    expect((received?.body as { text: string }).text).toContain("Approval");
  });

  it("postApprovalToSlack returns failed on non-2xx", async () => {
    const fakeFetch = async () => ({ ok: false, status: 500 } as Response);
    const r = await postApprovalToSlack(
      { tool: "x", severity: "low", reason: "r" },
      {
        env: { SLACK_WEBHOOK_URL: "https://hooks.slack.com/x" } as NodeJS.ProcessEnv,
        fetch: fakeFetch as unknown as typeof fetch,
      },
    );
    expect(r.posted).toBe(false);
    expect(r.reason).toBe("failed");
    expect(r.status).toBe(500);
  });

  it("postApprovalToSlack returns failed on fetch throw", async () => {
    const fakeFetch = async () => {
      throw new Error("network");
    };
    const r = await postApprovalToSlack(
      { tool: "x", severity: "low", reason: "r" },
      {
        env: { SLACK_WEBHOOK_URL: "https://hooks.slack.com/x" } as NodeJS.ProcessEnv,
        fetch: fakeFetch as unknown as typeof fetch,
      },
    );
    expect(r.posted).toBe(false);
    expect(r.reason).toBe("failed");
  });

  it("isApprovalSlackDisabled respects env toggle", () => {
    expect(isApprovalSlackDisabled({ MCP_GRAPH_APPROVAL_SLACK: "off" })).toBe(true);
    expect(isApprovalSlackDisabled({})).toBe(false);
  });
});
