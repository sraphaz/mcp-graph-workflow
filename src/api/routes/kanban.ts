/**
 * Kanban API router — board visualization, card moves, and orchestration.
 */

import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
import { buildKanbanBoard } from "../../core/kanban/kanban-builder.js";
import { generateSuggestions } from "../../core/kanban/kanban-orchestrator.js";
import { validateMove } from "../../core/kanban/kanban-validator.js";
import { DEFAULT_KANBAN_CONFIG } from "../../core/kanban/kanban-types.js";
import type { KanbanConfig, SwimlaneMode } from "../../core/kanban/kanban-types.js";

const KANBAN_SETTINGS_KEY = "kanban_config";

function loadConfig(storeRef: StoreRef): KanbanConfig {
  try {
    const raw = storeRef.current.getProjectSetting(KANBAN_SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as KanbanConfig;
  } catch { /* use defaults */ }
  return { ...DEFAULT_KANBAN_CONFIG };
}

function saveConfig(storeRef: StoreRef, config: KanbanConfig): void {
  storeRef.current.setProjectSetting(KANBAN_SETTINGS_KEY, JSON.stringify(config));
}

export function createKanbanRouter(storeRef: StoreRef): Router {
  const router = Router();

  // GET /board — returns full Kanban board
  router.get("/board", (req, res, next) => {
    try {
      const config = loadConfig(storeRef);

      // Allow swimlane override via query param
      const swimlane = req.query.swimlane as string | undefined;
      if (swimlane === "epic" || swimlane === "sprint" || swimlane === "none") {
        config.swimlaneMode = swimlane as SwimlaneMode;
      }

      const doc = storeRef.current.toGraphDocument();
      const board = buildKanbanBoard(doc, config);
      res.json(board);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /move — move a card to a new status
  router.patch("/move", (req, res, next) => {
    try {
      const { nodeId, newStatus } = req.body as { nodeId: string; newStatus: string };

      if (!nodeId || !newStatus) {
        res.status(400).json({ error: "nodeId and newStatus are required" });
        return;
      }

      const config = loadConfig(storeRef);
      const result = validateMove(
        storeRef.current,
        nodeId,
        newStatus as "backlog" | "ready" | "in_progress" | "blocked" | "done",
        config,
      );

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      // Apply the move
      storeRef.current.updateNodeStatus(
        nodeId,
        newStatus as "backlog" | "ready" | "in_progress" | "blocked" | "done",
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /suggestions — orchestration suggestions
  router.get("/suggestions", (_req, res, next) => {
    try {
      const config = loadConfig(storeRef);
      const doc = storeRef.current.toGraphDocument();
      const board = buildKanbanBoard(doc, config);
      const suggestions = generateSuggestions(doc, board);
      res.json({ suggestions });
    } catch (err) {
      next(err);
    }
  });

  // GET /config — current Kanban configuration
  router.get("/config", (_req, res, next) => {
    try {
      const config = loadConfig(storeRef);
      res.json(config);
    } catch (err) {
      next(err);
    }
  });

  // PUT /config — update Kanban configuration
  router.put("/config", (req, res, next) => {
    try {
      const newConfig = req.body as Partial<KanbanConfig>;
      const current = loadConfig(storeRef);
      const merged: KanbanConfig = {
        ...current,
        ...newConfig,
        wipLimits: { ...current.wipLimits, ...(newConfig.wipLimits ?? {}) },
      };
      saveConfig(storeRef, merged);
      res.json(merged);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
