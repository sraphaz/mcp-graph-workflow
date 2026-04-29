/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-15.2 — Approval Checker
 */

import { describe, it, expect } from "vitest";
import { checkApproval } from "../core/approval/approval-checker.js";

describe("checkApproval — Bash patterns", () => {
  it("flags 'rm -rf /' as critical", () => {
    const r = checkApproval({ tool: "Bash", input: { command: "rm -rf /" } });
    expect(r.requires_approval).toBe(true);
    expect(r.severity).toBe("critical");
    expect(r.reason).toMatch(/rm -rf/);
  });

  it("flags 'rm -rf' on subdirectories as high", () => {
    const r = checkApproval({ tool: "Bash", input: { command: "rm -rf node_modules" } });
    expect(r.requires_approval).toBe(true);
    expect(r.severity).toMatch(/critical|high/);
  });

  it("flags 'npm publish' as high", () => {
    const r = checkApproval({ tool: "Bash", input: { command: "npm publish --access public" } });
    expect(r.requires_approval).toBe(true);
    expect(r.severity).toBe("high");
  });

  it("flags 'git push --force' as high", () => {
    const r = checkApproval({ tool: "Bash", input: { command: "git push --force origin main" } });
    expect(r.requires_approval).toBe(true);
    expect(r.severity).toBe("high");
  });

  it("flags 'git push -f' (short flag) as high", () => {
    const r = checkApproval({ tool: "Bash", input: { command: "git push -f origin master" } });
    expect(r.requires_approval).toBe(true);
  });

  it("flags 'chmod 777' as medium", () => {
    const r = checkApproval({ tool: "Bash", input: { command: "chmod 777 /var/log" } });
    expect(r.requires_approval).toBe(true);
    expect(r.severity).toBe("medium");
  });

  it("flags writes to /etc as critical", () => {
    const r = checkApproval({ tool: "Bash", input: { command: "echo X > /etc/passwd" } });
    expect(r.requires_approval).toBe(true);
    expect(r.severity).toBe("critical");
  });

  it("does not flag harmless ls", () => {
    const r = checkApproval({ tool: "Bash", input: { command: "ls -la" } });
    expect(r.requires_approval).toBe(false);
  });

  it("does not flag npm install (not publish)", () => {
    const r = checkApproval({ tool: "Bash", input: { command: "npm install lodash" } });
    expect(r.requires_approval).toBe(false);
  });
});

describe("checkApproval — File patterns", () => {
  it("flags writes to .env files as high", () => {
    const r = checkApproval({ tool: "Write", input: { file_path: "/proj/.env", content: "X=1" } });
    expect(r.requires_approval).toBe(true);
    expect(r.severity).toBe("high");
  });

  it("flags writes to *.pem files as high", () => {
    const r = checkApproval({ tool: "Write", input: { file_path: "key.pem", content: "..." } });
    expect(r.requires_approval).toBe(true);
  });

  it("flags writes inside node_modules as medium", () => {
    const r = checkApproval({ tool: "Write", input: { file_path: "node_modules/foo/index.js", content: "" } });
    expect(r.requires_approval).toBe(true);
    expect(r.severity).toBe("medium");
  });

  it("does not flag normal source writes", () => {
    const r = checkApproval({ tool: "Write", input: { file_path: "src/app.ts", content: "" } });
    expect(r.requires_approval).toBe(false);
  });
});

describe("checkApproval — non-mutating tools", () => {
  it("returns no-approval for unknown tool with no input", () => {
    const r = checkApproval({ tool: "Read", input: { file_path: "src/app.ts" } });
    expect(r.requires_approval).toBe(false);
  });
});
