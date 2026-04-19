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
 * Doc Updater — named marker system for auto-generated doc sections.
 * Supports multiple independent marker pairs in a single file.
 */

function markerStart(name: string): string {
  return `<!-- mcp-graph:${name}:start -->`;
}

function markerEnd(name: string): string {
  return `<!-- mcp-graph:${name}:end -->`;
}

/**
 * Replace content between named markers. If markers don't exist,
 * returns content unchanged (safe by default).
 */
export function applySectionWithName(
  existingContent: string,
  sectionName: string,
  newContent: string,
): string {
  const startMarker = markerStart(sectionName);
  const endMarker = markerEnd(sectionName);

  const startIdx = existingContent.indexOf(startMarker);
  const endIdx = existingContent.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    return existingContent;
  }

  const before = existingContent.substring(0, startIdx + startMarker.length);
  const after = existingContent.substring(endIdx);

  return `${before}\n${newContent}\n${after}`;
}
