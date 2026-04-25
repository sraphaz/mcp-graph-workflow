/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  defaultGuardrail,
  isDomainAllowed,
  isCdpMethodForbidden,
} from "../core/browser-harness/guardrail-loader.js";

describe("guardrail helpers", () => {
  it("default guardrail allows all domains", () => {
    const g = defaultGuardrail();
    expect(isDomainAllowed("https://example.com", g)).toBe(true);
    expect(isDomainAllowed("http://localhost:3000/x", g)).toBe(true);
  });

  it("specific allowlist matches exact host and *.suffix", () => {
    const g = { ...defaultGuardrail(), allowedDomains: ["localhost", "*.github.com"] };
    expect(isDomainAllowed("http://localhost", g)).toBe(true);
    expect(isDomainAllowed("https://api.github.com/foo", g)).toBe(true);
    expect(isDomainAllowed("https://github.com.evil.com", g)).toBe(false);
    expect(isDomainAllowed("https://example.com", g)).toBe(false);
  });

  it("rejects malformed URLs", () => {
    const g = { ...defaultGuardrail(), allowedDomains: ["example.com"] };
    expect(isDomainAllowed("not a url", g)).toBe(false);
  });

  it("forbidden CDP methods", () => {
    const g = { ...defaultGuardrail(), forbiddenCdpMethods: ["Browser.close"] };
    expect(isCdpMethodForbidden("Browser.close", g)).toBe(true);
    expect(isCdpMethodForbidden("Page.navigate", g)).toBe(false);
  });
});
