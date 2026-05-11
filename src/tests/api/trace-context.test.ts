/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Story 5 subtask: Middleware API gera traceId (ULID) por request, injeta em req.context
 *
 * AC1: GIVEN a request WHEN traceContext middleware runs THEN req.context.traceId is set
 * AC2: GIVEN two requests WHEN traceContext runs THEN each gets a distinct traceId
 * AC3: GIVEN req has X-Trace-Id header WHEN traceContext runs THEN that value is used as traceId
 * AC4: GIVEN traceId is set WHEN middleware calls next() THEN next is called exactly once
 */

import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { traceContext } from "../../api/middleware/trace-context.js";

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

const mockRes = {} as Response;

// ── AC1: traceId injected ─────────────────────────────────────────────────────

describe("traceContext middleware — AC1: injects traceId into req.context", () => {
  it("AC1: req.context.traceId is a non-empty string after middleware runs", () => {
    const req = makeReq();
    const next: NextFunction = vi.fn();
    traceContext(req, mockRes, next);
    expect(typeof req.context.traceId).toBe("string");
    expect(req.context.traceId.length).toBeGreaterThan(0);
  });

  it("AC1: traceId looks like a time-sortable id (starts with alphanumeric chars)", () => {
    const req = makeReq();
    const next: NextFunction = vi.fn();
    traceContext(req, mockRes, next);
    expect(req.context.traceId).toMatch(/^[0-9a-z]+/i);
  });
});

// ── AC2: unique traceId per request ─────────────────────────────────────────────

describe("traceContext middleware — AC2: unique traceId per request", () => {
  it("AC2: two consecutive requests get distinct traceIds", () => {
    const req1 = makeReq();
    const req2 = makeReq();
    const next: NextFunction = vi.fn();
    traceContext(req1, mockRes, next);
    traceContext(req2, mockRes, next);
    expect(req1.context.traceId).not.toBe(req2.context.traceId);
  });
});

// ── AC3: X-Trace-Id header forwarded ─────────────────────────────────────────

describe("traceContext middleware — AC3: honours X-Trace-Id header", () => {
  it("AC3: uses X-Trace-Id header value when present", () => {
    const req = makeReq({ "x-trace-id": "upstream-trace-abc" });
    const next: NextFunction = vi.fn();
    traceContext(req, mockRes, next);
    expect(req.context.traceId).toBe("upstream-trace-abc");
  });

  it("AC3: generates own traceId when X-Trace-Id header is absent", () => {
    const req = makeReq();
    const next: NextFunction = vi.fn();
    traceContext(req, mockRes, next);
    expect(req.context.traceId).not.toBe("upstream-trace-abc");
    expect(req.context.traceId.length).toBeGreaterThan(0);
  });
});

// ── AC4: next() called exactly once ─────────────────────────────────────────

describe("traceContext middleware — AC4: calls next() exactly once", () => {
  it("AC4: next is called exactly once per request", () => {
    const req = makeReq();
    const next: NextFunction = vi.fn();
    traceContext(req, mockRes, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("AC4: next is called with no arguments (no error passed)", () => {
    const req = makeReq();
    const next: NextFunction = vi.fn();
    traceContext(req, mockRes, next);
    expect(next).toHaveBeenCalledWith();
  });
});
