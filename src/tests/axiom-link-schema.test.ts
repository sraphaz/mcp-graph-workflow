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

import { describe, it, expect } from "vitest";
import {
  AxiomLinkSchema,
  propagateRevocation,
  type AxiomLink,
} from "../schemas/axiom-link.schema.js";

function buildLink(overrides: Partial<AxiomLink> = {}): AxiomLink {
  return {
    id: "axiom_link_1",
    constitutionPrincipleId: "principle_1",
    acceptanceCriteriaIds: ["ac_1", "ac_2", "ac_3"],
    provenanceReceiptId: "prov_receipt_1",
    timestamp: "2026-04-19T22:00:00.000Z",
    revoked: false,
    ...overrides,
  };
}

describe("AxiomLinkSchema", () => {
  describe("AC1: Zod rejects axiom_link without provenance", () => {
    it("rejects a link missing provenanceReceiptId entirely", () => {
      const invalid = {
        id: "axiom_link_1",
        constitutionPrincipleId: "principle_1",
        acceptanceCriteriaIds: ["ac_1", "ac_2", "ac_3"],
        timestamp: "2026-04-19T22:00:00.000Z",
      };

      const result = AxiomLinkSchema.safeParse(invalid);

      expect(result.success).toBe(false);
    });

    it("rejects a link with empty provenanceReceiptId", () => {
      const result = AxiomLinkSchema.safeParse(buildLink({ provenanceReceiptId: "" }));

      expect(result.success).toBe(false);
    });

    it("accepts a link with non-empty provenanceReceiptId", () => {
      const result = AxiomLinkSchema.safeParse(buildLink());

      expect(result.success).toBe(true);
    });
  });

  describe("AC2: JSON serialization contains all 3 polo ids + timestamp", () => {
    it("serialized JSON carries constitutionPrincipleId, acceptanceCriteriaIds, provenanceReceiptId, and timestamp", () => {
      const link = buildLink({
        constitutionPrincipleId: "principle_axiom_1",
        acceptanceCriteriaIds: ["ac_alpha", "ac_beta"],
        provenanceReceiptId: "prov_receipt_xyz",
        timestamp: "2026-04-19T22:30:00.000Z",
      });

      const parsed = AxiomLinkSchema.parse(link);
      const json = JSON.stringify(parsed);

      expect(json).toContain("principle_axiom_1");
      expect(json).toContain("ac_alpha");
      expect(json).toContain("ac_beta");
      expect(json).toContain("prov_receipt_xyz");
      expect(json).toContain("2026-04-19T22:30:00.000Z");
    });

    it("round-trips via JSON without data loss", () => {
      const link = buildLink();

      const restored = AxiomLinkSchema.parse(JSON.parse(JSON.stringify(link)));

      expect(restored).toEqual(link);
    });

    it("rejects timestamps that are not ISO-like strings", () => {
      const result = AxiomLinkSchema.safeParse(buildLink({ timestamp: "not-a-date" as unknown as string }));

      expect(result.success).toBe(false);
    });
  });

  describe("AC3: revoked flag propagates to linked ACs when principle is revoked", () => {
    it("returns revoked=true and lists every linked AC when the principle is revoked", () => {
      const link = buildLink({
        acceptanceCriteriaIds: ["ac_1", "ac_2", "ac_3"],
        revoked: false,
      });

      const result = propagateRevocation(link, true);

      expect(result.link.revoked).toBe(true);
      expect(result.revokedAcIds).toEqual(["ac_1", "ac_2", "ac_3"]);
    });

    it("leaves the link untouched when the principle is not revoked", () => {
      const link = buildLink({ revoked: false });

      const result = propagateRevocation(link, false);

      expect(result.link.revoked).toBe(false);
      expect(result.link).toEqual(link);
      expect(result.revokedAcIds).toEqual([]);
    });

    it("is idempotent: re-propagating on an already revoked link keeps AC list and revoked=true", () => {
      const link = buildLink({ revoked: true });

      const result = propagateRevocation(link, true);

      expect(result.link.revoked).toBe(true);
      expect(result.revokedAcIds).toEqual(link.acceptanceCriteriaIds);
    });
  });

  describe("defaults", () => {
    it("defaults revoked to false when omitted on input", () => {
      const parsed = AxiomLinkSchema.parse({
        id: "axiom_link_2",
        constitutionPrincipleId: "principle_2",
        acceptanceCriteriaIds: ["ac_1"],
        provenanceReceiptId: "prov_receipt_2",
        timestamp: "2026-04-19T22:00:00.000Z",
      });

      expect(parsed.revoked).toBe(false);
    });

    it("requires at least one acceptance criterion id", () => {
      const result = AxiomLinkSchema.safeParse(buildLink({ acceptanceCriteriaIds: [] }));

      expect(result.success).toBe(false);
    });
  });
});
