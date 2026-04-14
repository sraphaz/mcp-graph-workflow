import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
import { detectBottlenecks } from "../../core/insights/bottleneck-detector.js";
import { scanSkills, recommendSkills } from "../../core/insights/skill-recommender.js";
import { calculateMetrics } from "../../core/insights/metrics-calculator.js";
import { calculatePhaseDistribution } from "../../core/insights/phase-distribution.js";
import { calculateKnowledgeQuality } from "../../core/insights/knowledge-quality-radar.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { calculateDoraMetrics } from "../../core/insights/dora-metrics.js";
import { captureFlowSnapshot, getCfdData } from "../../core/insights/flow-tracker.js";
import { analyzeSprintHealth } from "../../core/planner/sprint-health.js";

export function createInsightsRouter(storeRef: StoreRef, getBasePath: () => string): Router {
  const router = Router();

  router.get("/bottlenecks", (_req, res, next) => {
    try {
      const doc = storeRef.current.toGraphDocument();
      const report = detectBottlenecks(doc);
      res.json(report);
    } catch (err) {
      next(err);
    }
  });

  router.get("/recommendations", async (_req, res, next) => {
    try {
      const doc = storeRef.current.toGraphDocument();
      const skills = await scanSkills(getBasePath());
      const recommendations = recommendSkills(doc, skills);
      res.json({ recommendations });
    } catch (err) {
      next(err);
    }
  });

  router.get("/metrics", (_req, res, next) => {
    try {
      const doc = storeRef.current.toGraphDocument();
      const metrics = calculateMetrics(doc);
      res.json(metrics);
    } catch (err) {
      next(err);
    }
  });

  router.get("/dora", (_req, res, next) => {
    try {
      const metrics = calculateDoraMetrics(storeRef.current);
      res.json(metrics);
    } catch (err) {
      next(err);
    }
  });

  router.get("/cfd", (req, res, next) => {
    try {
      const project = storeRef.current.getProject();
      if (!project) {
        res.json([]);
        return;
      }
      const sprint = typeof req.query.sprint === "string" ? req.query.sprint : undefined;
      // Capture today's snapshot before returning data
      captureFlowSnapshot(storeRef.current, project.id, sprint);
      const data = getCfdData(storeRef.current, project.id, { sprint });
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  router.get("/phase-distribution", (_req, res, next) => {
    try {
      const doc = storeRef.current.toGraphDocument();
      const distribution = calculatePhaseDistribution(doc);
      res.json(distribution);
    } catch (err) {
      next(err);
    }
  });

  router.get("/knowledge-quality", (_req, res, next) => {
    try {
      const knowledgeStore = new KnowledgeStore(storeRef.current.getDb());
      const quality = calculateKnowledgeQuality(knowledgeStore);
      res.json(quality);
    } catch (err) {
      next(err);
    }
  });

  router.get("/sprint-health", (req, res, next) => {
    try {
      const doc = storeRef.current.toGraphDocument();
      const sprint = typeof req.query.sprint === "string" ? req.query.sprint : undefined;
      const report = analyzeSprintHealth(doc, sprint);
      res.json(report);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
