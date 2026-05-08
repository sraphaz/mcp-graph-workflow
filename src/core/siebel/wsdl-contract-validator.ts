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
 * WSDL Contract Validator — validates WSDL fields against Siebel BC fields.
 * Reports orphan fields, missing fields, and conformance scores per operation.
 */

import type { WsdlParseResult, WsdlComplexType } from "./wsdl-parser.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "wsdl-contract-validator.ts" });

export interface OperationValidation {
  operationName: string;
  serviceName: string;
  wsdlFieldCount: number;
  matchedFields: string[];
  orphanFields: string[];
  missingFields: string[];
  conformanceScore: number;
}

export interface ContractValidationResult {
  operations: OperationValidation[];
  overallScore: number;
}

/**
 * Collect all field names from BC children (type="field" or any child).
 */
function collectBcFieldNames(bcs: SiebelObject[]): Set<string> {
  const names = new Set<string>();
  for (const bc of bcs) {
    for (const child of bc.children) {
      names.add(child.name);
    }
  }
  return names;
}

/**
 * Collect all field names from WSDL types used by an operation (input + output).
 */
function collectWsdlFieldNames(
  inputType: string,
  outputType: string,
  typeMap: Map<string, WsdlComplexType>,
): string[] {
  const fields = new Set<string>();

  for (const typeName of [inputType, outputType]) {
    const complexType = typeMap.get(typeName);
    if (complexType) {
      for (const field of complexType.fields) {
        fields.add(field.name);
      }
    }
  }

  return [...fields];
}

/**
 * Validate WSDL contract against Siebel BC fields.
 * Reports matched, orphan (in WSDL but not BC), and missing (in BC but not WSDL) fields.
 */
export function validateWsdlContract(
  wsdl: WsdlParseResult,
  bcs: SiebelObject[],
): ContractValidationResult {
  const bcFieldNames = collectBcFieldNames(bcs);
  const typeMap = new Map(wsdl.types.map((t) => [t.name, t]));
  const serviceName = wsdl.services[0]?.name ?? "Unknown";

  const operations: OperationValidation[] = [];

  for (const op of wsdl.operations) {
    const wsdlFields = collectWsdlFieldNames(op.inputMessage, op.outputMessage, typeMap);

    const matched: string[] = [];
    const orphan: string[] = [];

    for (const field of wsdlFields) {
      if (bcFieldNames.has(field)) {
        matched.push(field);
      } else {
        orphan.push(field);
      }
    }

    // Fields in BC but not referenced by this operation's WSDL types
    const wsdlFieldSet = new Set(wsdlFields);
    const missing = [...bcFieldNames].filter((f) => !wsdlFieldSet.has(f));

    const conformanceScore = wsdlFields.length > 0
      ? Math.round((matched.length / wsdlFields.length) * 100)
      : 0;

    operations.push({
      operationName: op.name,
      serviceName,
      wsdlFieldCount: wsdlFields.length,
      matchedFields: matched,
      orphanFields: orphan,
      missingFields: missing,
      conformanceScore,
    });
  }

  const overallScore = operations.length > 0
    ? Math.round(operations.reduce((sum, o) => sum + o.conformanceScore, 0) / operations.length)
    : 100;

  log.info("WSDL contract validation complete", {
    serviceName,
    operationCount: String(operations.length),
    overallScore: String(overallScore),
  });

  return { operations, overallScore };
}
