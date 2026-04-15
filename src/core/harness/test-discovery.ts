/**
 * Test Discovery — stub for hook-injected import.
 * Auto-discovers test files matching a task title.
 */

import { logger } from "../utils/logger.js";

export function discoverTestFiles(taskTitle: string, cwd: string): string[] {
  logger.debug("test-discovery:stub", { taskTitle, cwd });
  return [];
}
