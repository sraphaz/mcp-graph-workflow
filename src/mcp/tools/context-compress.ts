import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { compressText } from "../../core/context/compress-text.js";
import { normalizeNewlines } from "../response-helpers.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerContextCompress(server: McpServer): void {
  server.tool(
    "context_compress",
    "Compress text using rule-based compression (no LLM, <50ms). Supports 4 formats: bullets (deduplicated bullet list), summary (topic sentences), steps (numbered/bullet extraction), json (markdown headers to key-value or fallback points array). Returns compressed text + stats.",
    {
      text: z.string().min(1).describe("Text to compress"),
      format: z
        .enum(["bullets", "summary", "steps", "json"])
        .describe("Compression format: bullets, summary, steps, or json"),
      max_tokens: z
        .number()
        .int()
        .min(50)
        .max(32000)
        .optional()
        .describe("Maximum tokens for output (default: 2000)"),
    },
    async ({ text, format, max_tokens }) => {
      const normalizedText = normalizeNewlines(text) ?? text;
      const maxTokens = max_tokens ?? 2000;

      logger.debug("tool:context_compress", { format, maxTokens, inputLength: text.length });

      const result = compressText(normalizedText, format, maxTokens);

      logger.info("tool:context_compress:ok", {
        format,
        inputTokens: result.stats.input_tokens,
        outputTokens: result.stats.output_tokens,
        reduction: result.stats.reduction_percent,
      });

      return mcpText({
        compressed: result.compressed,
        stats: result.stats,
      });
    },
  );
}
