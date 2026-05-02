/* eslint-disable security/detect-unsafe-regex */
/*!
 * Lint exemption: the regex patterns in this file are bounded
 * (literal alternations, short character classes, language-keyword
 * lookups) and run against parsed/structured input. The ReDoS class
 * the rule is designed to prevent is not reachable here.
 */
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

/**
 * AxiomLink — the tripolar contract that binds the three legs of operational
 * interoperability: a constitution principle, the acceptance criteria that
 * validate it, and the provenance receipt that proves the validation ran.
 *
 * An AxiomLink without provenance is rejected at the schema boundary: the
 * whole point of the tripod is that none of the three legs is optional.
 */

import { z } from "zod/v4";

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

export const AxiomLinkSchema = z.object({
  id: z.string().min(1).max(200),
  constitutionPrincipleId: z.string().min(1).max(200),
  acceptanceCriteriaIds: z.array(z.string().min(1).max(200)).min(1).max(200),
  provenanceReceiptId: z.string().min(1).max(200),
  timestamp: z.string().regex(ISO_TIMESTAMP_RE, "timestamp must be ISO-8601"),
  revoked: z.boolean().default(false),
});

export type AxiomLink = z.infer<typeof AxiomLinkSchema>;

export interface RevocationResult {
  readonly link: AxiomLink;
  readonly revokedAcIds: readonly string[];
}

/** propagateRevocation — auto-generated description placeholder. */
export function propagateRevocation(link: AxiomLink, isPrincipleRevoked: boolean): RevocationResult {
  if (!isPrincipleRevoked) {
    return { link, revokedAcIds: [] };
  }
  return {
    link: { ...link, revoked: true },
    revokedAcIds: [...link.acceptanceCriteriaIds],
  };
}
