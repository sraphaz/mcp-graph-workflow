/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * REST API for the browser-harness:
 *   POST   /sessions                 — start a new session (connect to CDP)
 *   DELETE /sessions/:id             — stop a session
 *   GET    /helpers                  — list helpers
 *   GET    /runs                     — list past runs
 *   GET    /runs/:id                 — fetch a single run
 *   GET    /runs/:id/report.html     — self-contained HTML report
 *   GET    /runs/:id/report.md       — Markdown report
 *   GET    /runs/:id/report.octane.xml — ALM-Octane test result XML
 *   GET    /runs/:id/screenshots/:i  — PNG screenshot for step i
 */

import { Router } from "express";
import {
  CdpClient,
  HelpersRegistry,
  HelpersRuntime,
  SelfHealService,
  SessionStore,
  loadGuardrail,
  seedBuiltInHelpers,
} from "../../core/browser-harness/index.js";
import { RunsStore } from "../../core/browser-harness/runs-store.js";
import {
  buildHtmlReport,
  buildMarkdownReport,
  buildOctaneXml,
} from "../../core/browser-harness/report-generator.js";
import type { StoreRef } from "../../core/store/store-manager.js";
import { createLogger } from "../../core/utils/logger.js";

const log = createLogger({ layer: "api", source: "browser-harness.ts" });

interface BrowserHarnessRuntime {
  registry: HelpersRegistry;
  runtime: HelpersRuntime;
  selfHeal: SelfHealService;
  sessions: SessionStore;
  runs: RunsStore;
}

const runtimes = new WeakMap<object, BrowserHarnessRuntime>();

function getRuntime(storeRef: StoreRef, basePath: string): BrowserHarnessRuntime {
  const key = storeRef as unknown as object;
  let bundle = runtimes.get(key);
  if (!bundle) {
    const db = storeRef.current.getDb();
    const registry = new HelpersRegistry(db);
    const runtime = new HelpersRuntime(registry);
    const runs = new RunsStore(db, basePath);
    const selfHeal = new SelfHealService(db, registry, runtime);
    const sessions = new SessionStore(db);
    seedBuiltInHelpers(registry);
    bundle = { registry, runtime, selfHeal, sessions, runs };
    runtimes.set(key, bundle);
  }
  return bundle;
}

/** createBrowserHarnessRouter — auto-generated description placeholder. */
export function createBrowserHarnessRouter(
  storeRef: StoreRef,
  getBasePath: () => string,
): Router {
  const router = Router();

  router.post("/sessions", async (req, res, next) => {
    try {
      const endpoint = String(req.body?.cdpEndpoint ?? "");
      if (!endpoint) {
        res.status(400).json({ ok: false, error: "cdpEndpoint required" });
        return;
      }
      const bundle = getRuntime(storeRef, getBasePath());
      const cdp = new CdpClient({ endpoint });
      await cdp.connect();
      const meta = bundle.sessions.register(cdp, endpoint, null);
      res.status(201).json({ ok: true, session: meta });
    } catch (err) {
      log.error("api:bh:sessions:create:error", { error: String(err) });
      next(err);
    }
  });

  router.delete("/sessions/:id", async (req, res, next) => {
    try {
      const bundle = getRuntime(storeRef, getBasePath());
      await bundle.sessions.close(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get("/helpers", (req, res) => {
    const origin = req.query.origin === "builtin" || req.query.origin === "agent" ? req.query.origin : undefined;
    const bundle = getRuntime(storeRef, getBasePath());
    const helpers = bundle.registry.list(origin);
    res.json({ ok: true, helpers });
  });

  router.get("/runs", (_req, res) => {
    const bundle = getRuntime(storeRef, getBasePath());
    const runs = bundle.runs.list(50);
    res.json({ ok: true, runs });
  });

  router.get("/runs/:id", (req, res) => {
    const bundle = getRuntime(storeRef, getBasePath());
    const run = bundle.runs.get(req.params.id);
    if (!run) {
      res.status(404).json({ ok: false, error: "run not found" });
      return;
    }
    res.json({ ok: true, run });
  });

  router.get("/runs/:id/report.html", (req, res) => {
    const bundle = getRuntime(storeRef, getBasePath());
    const run = bundle.runs.get(req.params.id);
    if (!run) { res.status(404).end(); return; }
    const screenshots = bundle.runs.loadAllScreenshots(run.id);
    const html = buildHtmlReport({ run, screenshots });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="bh-${run.id}.html"`);
    res.send(html);
  });

  router.get("/runs/:id/report.md", (req, res) => {
    const bundle = getRuntime(storeRef, getBasePath());
    const run = bundle.runs.get(req.params.id);
    if (!run) { res.status(404).end(); return; }
    const md = buildMarkdownReport({ run });
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="bh-${run.id}.md"`);
    res.send(md);
  });

  router.get("/runs/:id/report.octane.xml", (req, res) => {
    const bundle = getRuntime(storeRef, getBasePath());
    const run = bundle.runs.get(req.params.id);
    if (!run) { res.status(404).end(); return; }
    const xml = buildOctaneXml({ run });
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="bh-${run.id}.octane.xml"`);
    res.send(xml);
  });

  router.get("/runs/:id/screenshots/:step", (req, res) => {
    const bundle = getRuntime(storeRef, getBasePath());
    const stepIdx = parseInt(req.params.step, 10);
    if (isNaN(stepIdx)) { res.status(400).end(); return; }
    const png = bundle.runs.loadScreenshot(req.params.id, stepIdx);
    if (!png) { res.status(404).end(); return; }
    res.setHeader("Content-Type", "image/png");
    res.send(png);
  });

  router.get("/guardrail", (_req, res) => {
    res.json({ ok: true, guardrail: loadGuardrail() });
  });

  return router;
}
