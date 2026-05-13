/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.4: AC verifier pos-task com GWT evidence report
 * Tests for the AC evidence collector — pure deterministic verification.
 */

import { describe, it, expect } from "vitest";
import {
  collectAcEvidence,
  type AcEvidence,
  type AcEvidenceReport,
} from "../core/pipeline/ac-evidence-collector.js";

describe("collectAcEvidence — empty AC list", () => {
  // AC4: GIVEN task without ACs WHEN finish_task called THEN no regression
  it("returns empty report for empty ACs", () => {
    const report = collectAcEvidence([], []);
    expect(report.items).toHaveLength(0);
    expect(report.evidenceRequired).toBe(false);
    expect(report.autoVerifiedCount).toBe(0);
    expect(report.needsEvidenceCount).toBe(0);
  });
});

describe("collectAcEvidence — GWT format ACs", () => {
  const jwtAc = 'GIVEN user on login page WHEN enters valid creds THEN receives JWT';

  // AC1: GIVEN task with GWT AC WHEN finish_task called
  //       THEN response includes acEvidenceReport with status per criterion
  it("returns acEvidenceReport with status for each AC", () => {
    const report = collectAcEvidence([jwtAc], []);

    expect(report.items).toHaveLength(1);
    expect(report.items[0].acText).toBe(jwtAc);
    expect(report.items[0].format).toBe("gwt");
    expect(report.items[0].thenClause).toContain("JWT");
    expect(["auto_verified", "needs_evidence", "unverified"]).toContain(report.items[0].status);
  });

  // AC3: GIVEN AC not automatically verifiable WHEN finish_task without acEvidence
  //       THEN evidenceRequired: true (soft gate)
  it("sets evidenceRequired=true when GWT AC has no test file covering it", () => {
    const report = collectAcEvidence([jwtAc], []); // no test files

    expect(report.evidenceRequired).toBe(true);
    expect(report.needsEvidenceCount).toBe(1);
    expect(report.items[0].status).toBe("needs_evidence");
  });

  // AC2: GIVEN AC with THEN verifiable via test file WHEN finish_task called
  //       THEN status="auto_verified" with reference to test file
  it("marks AC as auto_verified when test file path matches THEN keywords", () => {
    // THEN clause: "jwt token created" → keywords: ["jwt", "token", "created"]
    // test path "jwt-token.test.ts" contains "jwt" and "token"
    const acText = "GIVEN valid password WHEN login THEN jwt token created";
    const testFiles = ["src/tests/jwt-token.test.ts"];

    const report = collectAcEvidence([acText], testFiles);

    expect(report.items[0].status).toBe("auto_verified");
    expect(report.items[0].testFileRef).toBeDefined();
    expect(report.items[0].testFileRef).toContain("jwt");
    expect(report.evidenceRequired).toBe(false);
    expect(report.autoVerifiedCount).toBe(1);
  });

  it("marks AC as needs_evidence when test file does not match THEN keywords", () => {
    const acText = "GIVEN user WHEN login THEN redirect to dashboard";
    const testFiles = ["src/tests/payment.test.ts"]; // no match

    const report = collectAcEvidence([acText], testFiles);

    expect(report.items[0].status).toBe("needs_evidence");
    expect(report.evidenceRequired).toBe(true);
  });

  it("handles multiple ACs — mix of auto_verified and needs_evidence", () => {
    const acs = [
      "GIVEN valid JWT WHEN decoded THEN jwt decode result valid",
      "GIVEN invalid password WHEN login THEN returns 401",
    ];
    const testFiles = ["src/tests/jwt-decode.test.ts"]; // covers first AC via "jwt"+"decode"

    const report = collectAcEvidence(acs, testFiles);

    expect(report.items).toHaveLength(2);
    const jwtItem = report.items.find((i: AcEvidence) => i.thenClause?.includes("decode"));
    const authItem = report.items.find((i: AcEvidence) => i.thenClause?.includes("401"));

    expect(jwtItem?.status).toBe("auto_verified");
    expect(authItem?.status).toBe("needs_evidence");
    expect(report.autoVerifiedCount).toBe(1);
    expect(report.needsEvidenceCount).toBe(1);
    expect(report.evidenceRequired).toBe(true);
  });
});

describe("collectAcEvidence — non-GWT ACs", () => {
  it("marks checklist ACs as unverified (cannot auto-verify)", () => {
    const checklistAc = "- User can enter email and password";
    const report = collectAcEvidence([checklistAc], ["src/tests/login.test.ts"]);

    expect(report.items[0].format).toBe("checklist");
    expect(report.items[0].status).toBe("unverified");
    expect(report.items[0].thenClause).toBeUndefined();
    // unverified does NOT trigger evidenceRequired (it's not actionable)
    expect(report.evidenceRequired).toBe(false);
  });

  it("marks free_text ACs as unverified", () => {
    const freeAc = "System validates credentials against database";
    const report = collectAcEvidence([freeAc], []);

    expect(report.items[0].format).toBe("free_text");
    expect(report.items[0].status).toBe("unverified");
    expect(report.evidenceRequired).toBe(false);
  });
});

describe("AcEvidenceReport type contract", () => {
  it("satisfies the type shape", () => {
    const report: AcEvidenceReport = collectAcEvidence(
      ["GIVEN x WHEN y THEN z"],
      [],
    );
    expect(typeof report.evidenceRequired).toBe("boolean");
    expect(typeof report.autoVerifiedCount).toBe("number");
    expect(typeof report.needsEvidenceCount).toBe("number");
    expect(Array.isArray(report.items)).toBe(true);
  });
});
