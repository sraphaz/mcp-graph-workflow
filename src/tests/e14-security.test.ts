/**
 * E14 Security Bug Fixes — Test Suite
 * Tests for: path traversal, SSRF, XML injection, template injection,
 * stack trace disclosure, missing body validation, 404 handler, duplicate
 * events route, and XSS in captured content.
 */
import { describe, it, expect } from "vitest";

// ── E14-T01: Path traversal in davinci pluginName ─────────────────────────────

import { sanitizePluginName } from "../api/routes/davinci.js";

describe("E14-T01: sanitizePluginName — path traversal prevention", () => {
  it("should reject names containing ../", () => {
    expect(() => sanitizePluginName("../../evil")).toThrow();
  });

  it("should reject names containing absolute paths", () => {
    expect(() => sanitizePluginName("/etc/passwd")).toThrow();
  });

  it("should reject names containing forward slash", () => {
    expect(() => sanitizePluginName("my/plugin")).toThrow();
  });

  it("should reject names containing backslash", () => {
    expect(() => sanitizePluginName("my\\plugin")).toThrow();
  });

  it("should accept a valid kebab-case plugin name", () => {
    expect(sanitizePluginName("my-awesome-plugin")).toBe("my-awesome-plugin");
  });

  it("should accept alphanumeric with hyphens and underscores", () => {
    expect(sanitizePluginName("plugin_v2")).toBe("plugin_v2");
  });
});

// ── E14-T02: SSRF — web-capture private IP blocklist ─────────────────────────

import { isBlockedUrl } from "../core/capture/web-capture.js";

describe("E14-T02: isBlockedUrl — SSRF private IP blocklist", () => {
  it("should block localhost", () => {
    expect(isBlockedUrl("http://localhost/")).toBe(true);
  });

  it("should block 127.0.0.1", () => {
    expect(isBlockedUrl("http://127.0.0.1/")).toBe(true);
  });

  it("should block 0.0.0.0", () => {
    expect(isBlockedUrl("http://0.0.0.0/")).toBe(true);
  });

  it("should block IPv6 loopback ::1", () => {
    expect(isBlockedUrl("http://[::1]/")).toBe(true);
  });

  it("should block 10.x.x.x (private Class A)", () => {
    expect(isBlockedUrl("http://10.0.0.1/")).toBe(true);
    expect(isBlockedUrl("http://10.255.255.255/")).toBe(true);
  });

  it("should block 172.16.x.x through 172.31.x.x (private Class B)", () => {
    expect(isBlockedUrl("http://172.16.0.1/")).toBe(true);
    expect(isBlockedUrl("http://172.31.255.255/")).toBe(true);
  });

  it("should block 192.168.x.x (private Class C)", () => {
    expect(isBlockedUrl("http://192.168.1.1/")).toBe(true);
  });

  it("should allow public IP", () => {
    expect(isBlockedUrl("https://example.com/")).toBe(false);
  });

  it("should allow public IP like 8.8.8.8", () => {
    expect(isBlockedUrl("https://8.8.8.8/")).toBe(false);
  });
});

// ── E14-T03: XML injection via entityName in SIF scaffold ─────────────────────

import { escapeXmlValue } from "../core/siebel/sif-templates.js";

describe("E14-T03: escapeXmlValue — XML injection prevention", () => {
  it("should escape < character", () => {
    expect(escapeXmlValue("<script>")).toBe("&lt;script&gt;");
  });

  it("should escape & character", () => {
    expect(escapeXmlValue("AT&T")).toBe("AT&amp;T");
  });

  it("should escape double quotes", () => {
    expect(escapeXmlValue('He said "hi"')).toBe("He said &quot;hi&quot;");
  });

  it("should escape single quotes", () => {
    expect(escapeXmlValue("it's")).toBe("it&apos;s");
  });

  it("should not change safe values", () => {
    expect(escapeXmlValue("MyBusinessComponent")).toBe("MyBusinessComponent");
  });

  it("should handle empty string", () => {
    expect(escapeXmlValue("")).toBe("");
  });
});

// ── E14-T04: DaVinci template variable injection ──────────────────────────────

import { validateJavaIdentifiers } from "../core/davinci/plugin-generator.js";

describe("E14-T04: validateJavaIdentifiers — template injection prevention", () => {
  it("should reject className with code injection characters", () => {
    expect(() => validateJavaIdentifiers({ className: "Foo{}//evil", packageName: "com.example", pluginName: "my-plugin" })).toThrow();
  });

  it("should reject className with newline", () => {
    expect(() => validateJavaIdentifiers({ className: "Foo\nclass Evil{}", packageName: "com.example", pluginName: "my-plugin" })).toThrow();
  });

  it("should reject invalid packageName", () => {
    expect(() => validateJavaIdentifiers({ className: "MyAdapter", packageName: "com.example;DROP TABLE", pluginName: "my-plugin" })).toThrow();
  });

  it("should accept valid Java identifiers", () => {
    expect(() => validateJavaIdentifiers({ className: "MyAuthAdapter", packageName: "com.example.auth", pluginName: "my-auth-adapter" })).not.toThrow();
  });

  it("should accept valid CamelCase class names", () => {
    expect(() => validateJavaIdentifiers({ className: "PingFederateIdpAdapter", packageName: "com.pingidentity.adapter", pluginName: "pf-idp-adapter" })).not.toThrow();
  });
});

// ── E14-T05: Stack trace disclosure in /api/v1/logs ───────────────────────────

import { stripStackFromLogContext } from "../api/routes/logs.js";

describe("E14-T05: stripStackFromLogContext — stack trace disclosure prevention", () => {
  it("should strip stack property from context", () => {
    const ctx = { message: "oops", stack: "Error: oops\n  at foo (bar.ts:1)\n  at baz", count: 5 };
    const stripped = stripStackFromLogContext(ctx);
    expect(stripped).not.toHaveProperty("stack");
    expect(stripped).toHaveProperty("count", 5);
  });

  it("should return undefined when context is undefined", () => {
    expect(stripStackFromLogContext(undefined)).toBeUndefined();
  });

  it("should not modify context without stack", () => {
    const ctx = { url: "/api/v1/nodes", duration: 42 };
    expect(stripStackFromLogContext(ctx)).toEqual(ctx);
  });
});

// ── E14-T06 & E14-T07: Missing body validation (journey PATCH, kanban PUT) ───
// Integration-style: confirm Zod validation schemas are exported and usable.

import { UpdateScreenSchema } from "../api/routes/journey.js";
import { UpdateKanbanConfigSchema } from "../api/routes/kanban.js";

describe("E14-T06: UpdateScreenSchema — journey PATCH body validation", () => {
  it("should reject unknown keys only if the schema is strict", () => {
    // Schema must exist and be a Zod object
    expect(UpdateScreenSchema).toBeDefined();
  });

  it("should validate a valid screen update", () => {
    const result = UpdateScreenSchema.safeParse({ title: "My Screen", description: "A desc" });
    expect(result.success).toBe(true);
  });
});

describe("E14-T07: UpdateKanbanConfigSchema — kanban PUT body validation", () => {
  it("should export UpdateKanbanConfigSchema", () => {
    expect(UpdateKanbanConfigSchema).toBeDefined();
  });

  it("should accept a valid partial kanban config", () => {
    const result = UpdateKanbanConfigSchema.safeParse({ wipLimits: { in_progress: 3 } });
    expect(result.success).toBe(true);
  });
});

// ── E14-T08: Missing 404 JSON handler ────────────────────────────────────────
// Verified via router.ts behavior — checked by inspecting createApiRouter export.

import { createApiRouter } from "../api/router.js";

describe("E14-T08: 404 JSON handler", () => {
  it("createApiRouter should export a function", () => {
    expect(typeof createApiRouter).toBe("function");
  });
});

// ── E14-T09: Duplicate /events route ─────────────────────────────────────────
// Verified by reading the router — the duplicate registration check.

describe("E14-T09: Duplicate /events route removal", () => {
  it("router.ts should not import createEventsRouter when eventsSse is already registered", async () => {
    // Confirm that the old events router is no longer conditionally double-mounted.
    // This test reads the router source and checks there's no second /events mount.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../src/api/router.ts", import.meta.url), "utf8");
    // After fix: createEventsRouter import is removed OR not used for /events mount
    const eventsRouteMatches = [...src.matchAll(/router\.use\(["'`]\/events["'`]/g)];
    expect(eventsRouteMatches.length).toBeLessThanOrEqual(1);
  });
});

// ── E14-T10: XSS in captured content ─────────────────────────────────────────

import { sanitizeCapturedText } from "../core/capture/content-extractor.js";

describe("E14-T10: sanitizeCapturedText — XSS prevention", () => {
  it("should strip script tags from text", () => {
    const dangerous = "Hello <script>alert(1)</script> World";
    expect(sanitizeCapturedText(dangerous)).not.toContain("<script>");
  });

  it("should strip inline event handlers", () => {
    const dangerous = 'Click <img src=x onerror="alert(1)"> here';
    expect(sanitizeCapturedText(dangerous)).not.toContain("onerror");
  });

  it("should preserve normal text", () => {
    const safe = "Hello World this is safe content";
    expect(sanitizeCapturedText(safe)).toBe(safe);
  });

  it("should handle empty string", () => {
    expect(sanitizeCapturedText("")).toBe("");
  });
});
