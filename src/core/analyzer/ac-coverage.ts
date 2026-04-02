import type { GraphDocument } from "../graph/graph-types.js";
import { logger } from "../utils/logger.js";

export interface EpicAcCoverage {
  epicId: string;
  title: string;
  totalTasks: number;
  tasksWithAC: number;
  coveragePercent: number;
  avgACsPerTask: number;
}

export interface AcCoverageReport {
  epics: EpicAcCoverage[];
  warnings: string[];
  overallCoverage: number;
}

export function analyzeAcCoverage(doc: GraphDocument): AcCoverageReport {
  const epics = doc.nodes.filter((n) => n.type === "epic");
  const epicCoverages: EpicAcCoverage[] = [];
  const warnings: string[] = [];

  for (const epic of epics) {
    const tasks = doc.nodes.filter(
      (n) =>
        n.parentId === epic.id &&
        (n.type === "task" || n.type === "subtask"),
    );

    if (tasks.length === 0) continue;

    const tasksWithAC = tasks.filter(
      (t) => t.acceptanceCriteria && t.acceptanceCriteria.length > 0,
    );
    const totalACs = tasks.reduce(
      (sum, t) => sum + (t.acceptanceCriteria?.length ?? 0),
      0,
    );
    const coveragePercent = Math.round(
      (tasksWithAC.length / tasks.length) * 100,
    );
    const avgACsPerTask =
      tasks.length > 0
        ? Math.round((totalACs / tasks.length) * 10) / 10
        : 0;

    if (tasksWithAC.length === 0) {
      warnings.push(
        `Epic "${epic.title}" has ${tasks.length} tasks but 0 acceptance criteria`,
      );
    }

    epicCoverages.push({
      epicId: epic.id,
      title: epic.title,
      totalTasks: tasks.length,
      tasksWithAC: tasksWithAC.length,
      coveragePercent,
      avgACsPerTask,
    });
  }

  const totalTasks = epicCoverages.reduce((s, e) => s + e.totalTasks, 0);
  const totalWithAC = epicCoverages.reduce((s, e) => s + e.tasksWithAC, 0);
  const overallCoverage =
    totalTasks > 0 ? Math.round((totalWithAC / totalTasks) * 100) : 100;

  logger.info("ac-coverage", {
    epics: epicCoverages.length,
    overall: overallCoverage,
  });

  return { epics: epicCoverages, warnings, overallCoverage };
}
