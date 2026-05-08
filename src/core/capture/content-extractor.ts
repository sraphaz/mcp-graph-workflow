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

import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "content-extractor.ts" });

export interface ExtractionOptions {
  /** CSS selector to extract content from (defaults to full body) */
  selector?: string;
}

export interface ExtractionResult {
  /** Extracted text in markdown format */
  text: string;
  /** Page title (from h1 or <title>) */
  title: string | null;
  /** Meta description if available */
  description: string | null;
  /** Word count of extracted text */
  wordCount: number;
}

const HEADING_MAP: Record<string, string> = {
  h1: "#",
  h2: "##",
  h3: "###",
  h4: "####",
  h5: "#####",
  h6: "######",
};

/**
 * Extract structured text content from raw HTML.
 * Converts headings to markdown, strips non-content elements,
 * and normalizes whitespace.
 */
export async function extractContent(
  html: string,
  options?: ExtractionOptions,
): Promise<ExtractionResult> {
  if (!html.trim()) {
    return { text: "", title: null, description: null, wordCount: 0 };
  }

  const { load } = await import("cheerio");
  log.info("Extracting content from HTML", { sizeChars: html.length, selector: options?.selector });

  const $Var = load(html);

  // Extract metadata before stripping
  const titleTag = $Var("title").first().text().trim() || null;
  const h1Text = $Var("h1").first().text().trim() || null;
  const title = h1Text ?? titleTag;
  const description = $Var('meta[name="description"]').attr("content") ?? null;

  // Remove non-content elements
  $Var("script, style, nav, footer, header, noscript, iframe, svg").remove();

  // Scope to selector if provided — extract scoped HTML and reload
  let scopedHtml: string;
  if (options?.selector) {
    const selected = $Var(options.selector);
    if (selected.length > 0) {
      scopedHtml = selected.html() ?? "";
    } else {
      log.info("Selector matched nothing, falling back to body", { selector: options.selector });
      scopedHtml = $Var("body").length ? ($Var("body").html() ?? "") : $Var.html();
    }
  } else {
    scopedHtml = $Var("body").length ? ($Var("body").html() ?? "") : $Var.html();
  }

  // Reload scoped content for transformation
  const $scoped = load(scopedHtml);

  // Convert headings to markdown
  for (const [tag, prefix] of Object.entries(HEADING_MAP)) {
    $scoped(tag).each(function (this: unknown) {
      const el = $scoped(this as string);
      const text = el.text().trim();
      el.replaceWith(`\n\n${prefix} ${text}\n\n`);
    });
  }

  // Convert list items to markdown bullets
  $scoped("li").each(function (this: unknown) {
    const el = $scoped(this as string);
    const text = el.text().trim();
    el.replaceWith(`\n- ${text}`);
  });

  // Add line breaks for block elements
  $scoped("p, div, section, article, blockquote, pre, br, tr").each(function (this: unknown) {
    $scoped(this as string).prepend("\n");
    $scoped(this as string).append("\n");
  });

  const rawText = $scoped.root().text();
  const text = rawText
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const wordCount = text ? text.split(/\s+/).length : 0;

  log.info("Content extracted", { textLength: text.length, wordCount });

  return {
    text: sanitizeCapturedText(text),
    title: title ? sanitizeCapturedText(title) : null,
    description: description ? sanitizeCapturedText(description) : null,
    wordCount,
  };
}

/**
 * Strip any residual HTML tags from captured text to prevent XSS when the
 * content is later rendered in a browser context.
 */
export function sanitizeCapturedText(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}
