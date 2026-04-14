import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
import { getAgentActivity } from "../../core/insights/agent-activity.js";

export function createAgentsRouter(storeRef: StoreRef): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    try {
      const db = storeRef.current.getDb();
      const agents = getAgentActivity(db);
      res.json({ agents, teamTaskEnabled: agents.length > 0 });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
