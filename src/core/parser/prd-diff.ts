/**
 * PRD diff tracking — compares two PRD texts section-by-section.
 * Used when re-importing a PRD with force=true to show what changed.
 */

import { normalize } from "./normalize.js";
import { segment } from "./segment.js";
import type { Section } from "./segment.js";
import { logger } from "../utils/logger.js";

export interface PrdDiffSection {
  title: string;
  status: "added" | "removed" | "modified" | "unchanged";
  oldContent?: string;
  newContent?: string;
}

export interface PrdDiffResult {
  sections: PrdDiffSection[];
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  unchangedCount: number;
}

/**
 * Compare two PRD texts section-by-section.
 * Matches sections by title (case-insensitive).
 */
export function diffPrd(oldText: string, newText: string): PrdDiffResult {
  const oldSections = segment(normalize(oldText));
  const newSections = segment(normalize(newText));

  const oldMap = new Map<string, Section>();
  for (const s of oldSections) oldMap.set(s.title.toLowerCase(), s);

  const newMap = new Map<string, Section>();
  for (const s of newSections) newMap.set(s.title.toLowerCase(), s);

  const sections: PrdDiffSection[] = [];
  const processed = new Set<string>();

  // Check old sections against new
  for (const [key, oldSec] of oldMap) {
    processed.add(key);
    const newSec = newMap.get(key);
    if (!newSec) {
      sections.push({ title: oldSec.title, status: "removed", oldContent: oldSec.body });
    } else if (oldSec.body.trim() !== newSec.body.trim()) {
      sections.push({
        title: newSec.title,
        status: "modified",
        oldContent: oldSec.body,
        newContent: newSec.body,
      });
    } else {
      sections.push({ title: oldSec.title, status: "unchanged" });
    }
  }

  // Check new sections not present in old
  for (const [key, newSec] of newMap) {
    if (!processed.has(key)) {
      sections.push({ title: newSec.title, status: "added", newContent: newSec.body });
    }
  }

  const addedCount = sections.filter((s) => s.status === "added").length;
  const removedCount = sections.filter((s) => s.status === "removed").length;
  const modifiedCount = sections.filter((s) => s.status === "modified").length;
  const unchangedCount = sections.filter((s) => s.status === "unchanged").length;

  logger.info("prd-diff", { added: addedCount, removed: removedCount, modified: modifiedCount });

  return { sections, addedCount, removedCount, modifiedCount, unchangedCount };
}
