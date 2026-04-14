/**
 * Native Memory Reader — reads/writes project memories from workflow-graph/memories/.
 * Replaces the Serena MCP dependency for memory management.
 */

import path from "node:path";
import { readdir, readFile, writeFile, mkdir, unlink, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { logger } from "../utils/logger.js";
import { STORE_DIR } from "../utils/constants.js";
import { assertPathInside } from "../utils/safe-path.js";

export interface ProjectMemory {
  name: string;
  content: string;
  sizeBytes: number;
}

const MEMORIES_DIR = "memories";

/**
 * Resolve the absolute path to the memories directory.
 */
function memoriesPath(basePath: string): string {
  return path.join(basePath, STORE_DIR, MEMORIES_DIR);
}

/**
 * Validate that a memory name resolves to a path inside the memories directory.
 * Uses centralized assertPathInside for comprehensive traversal protection (Bug #003).
 */
function safePath(basePath: string, name: string): string {
  const memDir = path.resolve(memoriesPath(basePath));
  return assertPathInside(`${name}.md`, memDir);
}

/**
 * Recursively collect all .md files under a directory, returning paths relative to root.
 */
async function collectMdFiles(dir: string, root: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectMdFiles(fullPath, root);
      results.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const relative = path.relative(root, fullPath).replace(/\\/g, "/");
      results.push(relative.replace(/\.md$/, ""));
    }
  }

  return results;
}

/**
 * List all memory files from workflow-graph/memories/ (supports nested dirs).
 */
export async function listMemories(basePath: string): Promise<string[]> {
  try {
    const dir = memoriesPath(basePath);
    return await collectMdFiles(dir, dir);
  } catch {
    logger.info("No memories directory found", { basePath });
    return [];
  }
}

/**
 * Read a specific memory file.
 */
export async function readMemory(basePath: string, name: string): Promise<ProjectMemory | null> {
  try {
    const filePath = safePath(basePath, name);
    const content = await readFile(filePath, "utf-8");
    return {
      name,
      content,
      sizeBytes: Buffer.byteLength(content, "utf-8"),
    };
  } catch {
    logger.debug("Memory not found", { name });
    return null;
  }
}

/**
 * Read all memories at once.
 */
export async function readAllMemories(basePath: string): Promise<ProjectMemory[]> {
  const names = await listMemories(basePath);
  const memories: ProjectMemory[] = [];

  for (const name of names) {
    const memory = await readMemory(basePath, name);
    if (memory) memories.push(memory);
  }

  return memories;
}

/**
 * Write a memory file. Creates parent directories if needed.
 */
export async function writeMemory(basePath: string, name: string, content: string): Promise<void> {
  const filePath = safePath(basePath, name);
  const dir = path.dirname(filePath);

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  // Atomic write: write to temp file then rename (prevents corrupted reads on concurrent access)
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  await writeFile(tmpPath, content, "utf-8");
  await rename(tmpPath, filePath);
  logger.info("Memory written", { name, sizeBytes: Buffer.byteLength(content, "utf-8") });
}

/**
 * Delete a memory file. Returns true if deleted, false if not found.
 */
export async function deleteMemory(basePath: string, name: string): Promise<boolean> {
  try {
    const filePath = safePath(basePath, name);
    await unlink(filePath);
    logger.info("Memory deleted", { name });
    return true;
  } catch {
    return false;
  }
}
