/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-vendor-insights-scanner — Task 1.1: pure vendor directory walker.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface VendorFile {
  path: string;
  ext: string;
  loc: number;
  sizeBytes: number;
}

export interface VendorProject {
  name: string;
  root: string;
  files: VendorFile[];
  readme?: string;
  skill?: string;
}

export interface VendorTree {
  projects: VendorProject[];
  scannedAt: string;
}

const IGNORED_DIRS = new Set(["__pycache__", ".git", "node_modules"]);
const ALLOWED_EXTS = new Set([".py", ".ts", ".md", ".json"]);

function countLines(content: string): number {
  if (content.length === 0) return 0;
  const lines = content.split("\n");
  // trailing newline produces empty last element — don't count it
  return lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
}

function collectFiles(dir: string): VendorFile[] {
  const results: VendorFile[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      results.push(...collectFiles(path.join(dir, entry.name)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!ALLOWED_EXTS.has(ext)) continue;
      const fullPath = path.join(dir, entry.name);
      const content = fs.readFileSync(fullPath, "utf8");
      const stat = fs.statSync(fullPath);
      results.push({ path: fullPath, ext, loc: countLines(content), sizeBytes: stat.size });
    }
  }
  return results;
}

function readOptional(filePath: string): string | undefined {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
}

export function walkVendor(rootPath: string): VendorTree {
  const projects: VendorProject[] = [];

  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const projectRoot = path.join(rootPath, entry.name);
    const files = collectFiles(projectRoot);
    const readme = readOptional(path.join(projectRoot, "README.md"));
    const skill = readOptional(path.join(projectRoot, "SKILL.md"));
    projects.push({ name: entry.name, root: projectRoot, files, readme, skill });
  }

  return { projects, scannedAt: new Date().toISOString() };
}
