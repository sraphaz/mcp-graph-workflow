#!/usr/bin/env tsx
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * CLI helper: download the all-MiniLM-L6-v2 ONNX model to workflow-graph/models/.
 *
 * Usage: npm run model:download
 */

import { join } from "node:path";
import { ensureOnnxModelDir, getOnnxProvider } from "../src/core/rag/onnx-embeddings.js";

const MODELS_DIR = join(process.cwd(), "workflow-graph", "models");

async function main(): Promise<void> {
  console.log(`[model:download] Ensuring models directory: ${MODELS_DIR}`);
  ensureOnnxModelDir(MODELS_DIR);

  console.log("[model:download] Downloading model (this may take a moment)...");
  const provider = await getOnnxProvider(MODELS_DIR);

  if (provider) {
    console.log(`[model:download] Model ready — provider: ${provider.name}, dimensions: ${provider.dimensions}`);
  } else {
    console.error(
      "[model:download] Download failed or onnxruntime-node is not installed.\n" +
      "  Install it with: npm install onnxruntime-node",
    );
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("[model:download] Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
