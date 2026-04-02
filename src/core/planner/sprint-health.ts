/**
 * Sprint Health — analyzes the health of a sprint based on task metrics.
 * Returns a health grade (healthy/at_risk/critical) with detailed metrics and warnings.
 */

import type { GraphDocument } from "../graph/graph-types.js";
import { XP_SIZE_POINTS } from "../utils/xp-sizing.js";
import { logger } from "../utils/logger.js";

export interface SprintHealthReport {
  sprint: string | null;
  health: "healthy" | "at_risk" | "critical";
  metrics: {
    totalPoints: number;
    taskCount: number;
    doneCount: number;
    blockedCount: number;
    burndownRatio: number;
    blockedRatio: number;
    tasksWithoutAC: number;
    externalDeps: number;
  };
  warnings: string[];
}

export function analyzeSprintHealth(doc: GraphDocument, sprintFilter?: string): SprintHealthReport {
  const tasks = doc.nodes.filter((n) =>
    (n.type === "task" || n.type === "subtask") &&
    (sprintFilter ? n.sprint === sprintFilter : true),
  );

  const totalPoints = tasks.reduce((sum, t) => sum + (XP_SIZE_POINTS[t.xpSize ?? "M"] ?? 3), 0);
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const blockedCount = tasks.filter((t) => t.status === "blocked" || t.blocked).length;
  const tasksWithoutAC = tasks.filter((t) => !t.acceptanceCriteria || t.acceptanceCriteria.length === 0).length;

  // External deps: tasks in this sprint that depend on tasks in OTHER sprints
  const sprintTaskIds = new Set(tasks.map((t) => t.id));
  const externalDeps = doc.edges.filter((e) =>
    e.relationType === "depends_on" &&
    sprintTaskIds.has(e.from) &&
    !sprintTaskIds.has(e.to),
  ).length;

  const burndownRatio = tasks.length > 0 ? doneCount / tasks.length : 1;
  const blockedRatio = tasks.length > 0 ? blockedCount / tasks.length : 0;

  const warnings: string[] = [];
  if (blockedRatio > 0.3) warnings.push(`${blockedCount} tasks blocked (${Math.round(blockedRatio * 100)}%)`);
  if (tasksWithoutAC > 0) warnings.push(`${tasksWithoutAC} tasks without acceptance criteria`);
  if (externalDeps > 0) warnings.push(`${externalDeps} external dependencies`);

  let health: "healthy" | "at_risk" | "critical" = "healthy";
  if (blockedRatio > 0.3 || burndownRatio < 0.2) health = "critical";
  else if (blockedRatio > 0.1 || tasksWithoutAC > tasks.length * 0.3) health = "at_risk";

  logger.info("sprint-health", { sprint: sprintFilter ?? "all", health, tasks: tasks.length });

  return {
    sprint: sprintFilter ?? null,
    health,
    metrics: { totalPoints, taskCount: tasks.length, doneCount, blockedCount, burndownRatio, blockedRatio, tasksWithoutAC, externalDeps },
    warnings,
  };
}
