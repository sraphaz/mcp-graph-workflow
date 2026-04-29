/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T05 — Memory PII scanner.
 * Tests detection + redaction of email, SSN, credit card (Luhn), API tokens.
 */

import { describe, it, expect } from "vitest";
import {
  scanForPii,
  redactPii,
  hasPii,
  type PiiKind,
} from "../core/hooks/memory-pii-scanner.js";

describe("scanForPii (E21.T05)", () => {
  it("returns empty array when content has no PII", () => {
    expect(scanForPii("just a regular sentence")).toEqual([]);
  });

  it("detects email addresses", () => {
    const hits = scanForPii("contact me at user@example.com please");
    const kinds = hits.map((h) => h.kind);
    expect(kinds).toContain<PiiKind>("email");
  });

  it("detects multiple emails", () => {
    const hits = scanForPii("a@b.com and c@d.io");
    expect(hits.filter((h) => h.kind === "email").length).toBe(2);
  });

  it("detects SSN (XXX-XX-XXXX)", () => {
    const hits = scanForPii("SSN: 123-45-6789");
    expect(hits.some((h) => h.kind === "ssn")).toBe(true);
  });

  it("detects credit card with valid Luhn checksum", () => {
    // 4532015112830366 is a valid test Visa Luhn
    const hits = scanForPii("card 4532015112830366");
    expect(hits.some((h) => h.kind === "credit_card")).toBe(true);
  });

  it("ignores 16-digit numbers that fail Luhn check", () => {
    // 4532015112830367 — same prefix, last digit changed → invalid Luhn
    const hits = scanForPii("number 4532015112830367 here");
    expect(hits.some((h) => h.kind === "credit_card")).toBe(false);
  });

  it("detects API tokens with sk- prefix (OpenAI/Anthropic-style)", () => {
    const hits = scanForPii("export OPENAI_API_KEY=sk-abc123def456ghi789jkl012");
    expect(hits.some((h) => h.kind === "api_token")).toBe(true);
  });

  it("detects API tokens with xoxb- prefix (Slack)", () => {
    const hits = scanForPii("token xoxb-1234-5678-abcdefghij");
    expect(hits.some((h) => h.kind === "api_token")).toBe(true);
  });

  it("detects API tokens with ghp_ prefix (GitHub)", () => {
    const hits = scanForPii("ghp_abcdefghijklmnopqrstuvwxyz0123456789");
    expect(hits.some((h) => h.kind === "api_token")).toBe(true);
  });

  it("returns hit with start/end positions in content", () => {
    const hits = scanForPii("foo a@b.com bar");
    const email = hits.find((h) => h.kind === "email");
    expect(email?.start).toBe(4);
    expect(email?.end).toBe(11);
  });
});

describe("hasPii (E21.T05)", () => {
  it("returns true when any PII present", () => {
    expect(hasPii("user@example.com")).toBe(true);
  });

  it("returns false when content is clean", () => {
    expect(hasPii("nothing sensitive here")).toBe(false);
  });
});

describe("redactPii (E21.T05)", () => {
  it("replaces email with [REDACTED-EMAIL]", () => {
    expect(redactPii("ping a@b.com today")).toBe("ping [REDACTED-EMAIL] today");
  });

  it("replaces SSN with [REDACTED-SSN]", () => {
    expect(redactPii("ssn 123-45-6789 ok")).toBe("ssn [REDACTED-SSN] ok");
  });

  it("replaces credit card with [REDACTED-CC]", () => {
    expect(redactPii("card 4532015112830366 expires")).toBe("card [REDACTED-CC] expires");
  });

  it("replaces API token with [REDACTED-TOKEN]", () => {
    expect(redactPii("OPENAI_API_KEY=sk-abc123def456ghi789jkl012 set")).toBe(
      "OPENAI_API_KEY=[REDACTED-TOKEN] set",
    );
  });

  it("redacts multiple PII in one pass", () => {
    const out = redactPii("a@b.com 123-45-6789 here");
    expect(out).toBe("[REDACTED-EMAIL] [REDACTED-SSN] here");
  });

  it("returns content unchanged when no PII", () => {
    expect(redactPii("clean text")).toBe("clean text");
  });
});
