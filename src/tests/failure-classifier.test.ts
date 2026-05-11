/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 5.1 — failure-classifier.ts (pure).
 *
 * AC1: CDP error "Cannot find element" → selector_missing
 * AC2: Navigate timeout > 30s → network_block
 * AC3: No match → "unknown" (never guesses)
 */

import { describe, it, expect } from "vitest";
import { classifyFailure, type FailureKind } from "../core/browser-harness/failure-classifier.js";

describe("failure-classifier — AC1: element lookup failures", () => {
  it('CDP "Cannot find element" → selector_missing', () => {
    expect(classifyFailure("Cannot find element: #submit-btn")).toBe("selector_missing" satisfies FailureKind);
  });

  it('CDP "No element found" → selector_missing', () => {
    expect(classifyFailure("No element found for selector .nav-link")).toBe("selector_missing");
  });

  it('CDP "Element is not attached" → selector_stale', () => {
    expect(classifyFailure("Element is not attached to the DOM")).toBe("selector_stale");
  });

  it('"stale element reference" → selector_stale', () => {
    expect(classifyFailure("stale element reference: element is not attached to the page document")).toBe("selector_stale");
  });
});

describe("failure-classifier — AC2: navigation / network failures", () => {
  it("navigate timeout > 30s → network_block", () => {
    expect(classifyFailure("Navigation timeout exceeded 30000ms")).toBe("network_block");
  });

  it('"net::ERR_" prefix → network_block', () => {
    expect(classifyFailure("net::ERR_CONNECTION_REFUSED")).toBe("network_block");
  });

  it('"Timeout waiting for" → wait_too_short', () => {
    expect(classifyFailure("Timeout waiting for selector #spinner to be hidden")).toBe("wait_too_short");
  });

  it('"Frame was detached" → wrong_tab', () => {
    expect(classifyFailure("Frame was detached")).toBe("wrong_tab");
  });

  it('"cross-origin frame" → iframe_boundary', () => {
    expect(classifyFailure("Cannot access cross-origin frame content")).toBe("iframe_boundary");
  });
});

describe("failure-classifier — AC3: unknown fallback, never guesses", () => {
  it("unrecognised error → unknown", () => {
    expect(classifyFailure("some completely unexpected internal error")).toBe("unknown");
  });

  it("empty string → unknown", () => {
    expect(classifyFailure("")).toBe("unknown");
  });

  it("whitespace-only → unknown", () => {
    expect(classifyFailure("   ")).toBe("unknown");
  });
});
