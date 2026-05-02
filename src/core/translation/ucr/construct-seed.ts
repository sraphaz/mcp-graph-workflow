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
 * UCR Seed Loader — loads construct-seed-data.json into ConstructRegistry.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { UcrSeedDataSchema } from "./construct-types.js";
import type { UcrSeedData } from "./construct-types.js";
import type { ConstructRegistry, SeedResult } from "./construct-registry.js";
import { logger } from "../../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SEED_PATH = resolve(__dirname, "construct-seed-data.json");

/** Load the built-in seed data and populate the registry. Idempotent. */
export function loadAndSeedRegistry(registry: ConstructRegistry): SeedResult {
  return seedRegistryFromFile(registry, DEFAULT_SEED_PATH);
}

/** Load seed data from a custom JSON file and populate the registry. Validates against Zod schema. */
export function seedRegistryFromFile(registry: ConstructRegistry, filePath: string): SeedResult {
  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;

  const validated = UcrSeedDataSchema.parse(parsed);

  const resultValue = registry.seedFromJson(validated);

  logger.info("ucr:seed:file", {
    file: filePath,
    categories: resultValue.categories,
    constructs: resultValue.constructs,
    mappings: resultValue.mappings,
  });

  return resultValue;
}

/** Parse and validate seed data without inserting (dry-run). */
export function validateSeedData(filePath: string): UcrSeedData {
  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  return UcrSeedDataSchema.parse(parsed);
}
