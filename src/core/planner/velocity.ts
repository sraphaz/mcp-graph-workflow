/**
 * Velocity tracking: measures sprint completion metrics.
 *
 * Computes:
 * - Tasks completed per sprint
 * - Average XP size completed
 * - Estimated completion time (based on created→done timestamps)
 */

import { z } from "zod/v4";
import type { GraphDocument, GraphNode } from "../graph/graph-types.js";
import { XP_SIZE_POINTS } from "../utils/xp-sizing.js";
import { logger } from "../utils/logger.js";

const VelocityFilterSchema = z.object({
  sprintId: z.string().optional(),
  limit: z.number().optional(),
});

/** Velocity metrics for a single sprint — tasks completed, points, and timing. */
export interface SprintVelocity {
  sprint: string;
  tasksCompleted: number;
  totalPoints: number;
  avgPointsPerTask: number;
  avgCompletionHours: number | null;
  tasks: VelocityTask[];
}

/** Velocity entry for a single completed task with XP points and timing. */
export interface VelocityTask {
  id: string;
  title: string;
  xpSize: string;
  points: number;
  completionHours: number | null;
}

/** Velocity breakdown by first tag category across all done tasks. */
export interface CategoryVelocity {
  category: string;
  tasksCompleted: number;
  totalPoints: number;
  avgCompletionHours: number | null;
}

/** Aggregated velocity across all sprints with per-sprint and overall metrics. */
export interface VelocitySummary {
  sprints: SprintVelocity[];
  byCategory: CategoryVelocity[];
  overall: {
    totalTasksCompleted: number;
    totalPoints: number;
    avgPointsPerSprint: number;
    avgCompletionHours: number | null;
  };
}

/**
 * Calculate velocity metrics for all sprints in the graph.
 */
export function calculateVelocity(doc: GraphDocument, filter?: { sprintId?: string; limit?: number }): VelocitySummary {
  const validatedFilter = VelocityFilterSchema.parse(filter ?? {});
  // Group done tasks by sprint
  const doneTasks = doc.nodes.filter(
    (n) => n.status === "done" && (n.type === "task" || n.type === "subtask"),
  );

  const bySprint = new Map<string, GraphNode[]>();

  for (const node of doneTasks) {
    const sprint = node.sprint ?? "(no sprint)";
    const group = bySprint.get(sprint) ?? [];
    group.push(node);
    bySprint.set(sprint, group);
  }

  const sprints: SprintVelocity[] = [];

  for (const [sprint, tasks] of bySprint) {
    const velocityTasks: VelocityTask[] = tasks.map((t) => {
      const points = XP_SIZE_POINTS[t.xpSize ?? "M"] ?? 3;
      const completionHours = computeCompletionHours(t);
      return {
        id: t.id,
        title: t.title,
        xpSize: t.xpSize ?? "M",
        points,
        completionHours,
      };
    });

    const totalPoints = velocityTasks.reduce((sum, t) => sum + t.points, 0);
    const hoursValues = velocityTasks
      .map((t) => t.completionHours)
      .filter((h): h is number => h !== null);

    sprints.push({
      sprint,
      tasksCompleted: tasks.length,
      totalPoints,
      avgPointsPerTask: tasks.length > 0 ? Math.round((totalPoints / tasks.length) * 10) / 10 : 0,
      avgCompletionHours: hoursValues.length > 0
        ? Math.round((hoursValues.reduce((a, b) => a + b, 0) / hoursValues.length) * 10) / 10
        : null,
      tasks: velocityTasks,
    });
  }

  // Sort sprints by name, optionally filter by sprintId. Clone to avoid the
  // subtle aliasing bug where `filteredSprints === sprints` and the later
  // `sprints.length = 0` would blank both sides before the push.
  const filteredSprints = validatedFilter.sprintId
    ? sprints.filter((s) => s.sprint === validatedFilter.sprintId)
    : [...sprints];
  filteredSprints.sort((a, b) => a.sprint.localeCompare(b.sprint));
  sprints.length = 0;
  sprints.push(...filteredSprints);

  const totalTasksCompleted = doneTasks.length;
  const totalPoints = sprints.reduce((sum, s) => sum + s.totalPoints, 0);
  // E3-T05: Use real sprint count, not fallback || 1
  const sprintCount = sprints.length;

  const allHours = sprints
    .flatMap((s) => s.tasks)
    .map((t) => t.completionHours)
    .filter((h): h is number => h !== null);

  // Group by category (first tag)
  const byCategoryMap = new Map<string, GraphNode[]>();
  for (const node of doneTasks) {
    const category = node.tags?.[0] ?? "(untagged)";
    const group = byCategoryMap.get(category) ?? [];
    group.push(node);
    byCategoryMap.set(category, group);
  }

  const byCategory: CategoryVelocity[] = Array.from(byCategoryMap.entries()).map(([category, tasks]) => {
    const catPoints = tasks.reduce((sum, t) => sum + (XP_SIZE_POINTS[t.xpSize ?? "M"] ?? 3), 0);
    const catHours = tasks
      .map((t) => computeCompletionHours(t))
      .filter((h): h is number => h !== null);
    return {
      category,
      tasksCompleted: tasks.length,
      totalPoints: catPoints,
      avgCompletionHours: catHours.length > 0
        ? Math.round((catHours.reduce((a, b) => a + b, 0) / catHours.length) * 10) / 10
        : null,
    };
  }).sort((a, b) => a.category.localeCompare(b.category));

  logger.info(`Velocity: ${totalTasksCompleted} tasks done, ${totalPoints} points across ${sprints.length} sprints`);

  return {
    sprints,
    byCategory,
    overall: {
      totalTasksCompleted,
      totalPoints,
      avgPointsPerSprint: sprintCount > 0 ? Math.round((totalPoints / sprintCount) * 10) / 10 : 0,
      avgCompletionHours: allHours.length > 0
        ? Math.round((allHours.reduce((a, b) => a + b, 0) / allHours.length) * 10) / 10
        : null,
    },
  };
}

/**
 * Estimate completion time in hours from createdAt to updatedAt.
 * Returns null if timestamps are invalid or equal.
 */
function computeCompletionHours(node: GraphNode): number | null {
  try {
    // Bug #094 + E5-T02: guard null/undefined/empty timestamps before Date parse
    if (!node.createdAt?.trim() || !node.updatedAt?.trim()) return null;
    const created = new Date(node.createdAt).getTime();
    const updated = new Date(node.updatedAt).getTime();
    if (isNaN(created) || isNaN(updated) || updated <= created) return null;
    return Math.round(((updated - created) / (1000 * 60 * 60)) * 10) / 10;
  } catch {
    return null;
  }
}
