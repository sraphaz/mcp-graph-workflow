/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 5.1 — Cadastrar model-hub.config.json como atomic file
 *
 * AC1: GIVEN init em projeto novo WHEN executado THEN cria model-hub.config.json com defaults válidos
 * AC2: GIVEN config customizada WHEN update roda THEN preserva custom; só atualiza
 *      _managedSchemaVersion + adiciona campos novos
 */

import { describe, it, expect } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import {
  initModelHubConfig,
  updateModelHubConfig,
  MODEL_HUB_CONFIG_DEFAULTS,
  MODEL_HUB_SCHEMA_VERSION,
} from "../core/model-hub/model-hub-config-atomic.js";

// ---------------------------------------------------------------------------
// AC1: init creates model-hub.config.json with valid defaults
// ---------------------------------------------------------------------------

describe("initModelHubConfig — AC1: creates file with defaults", () => {
  it("creates model-hub.config.json in the project dir", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mhc-test-"));
    try {
      await initModelHubConfig(dir);
      expect(existsSync(join(dir, "model-hub.config.json"))).toBe(true);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("default file contains port 11500", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mhc-test-"));
    try {
      await initModelHubConfig(dir);
      const raw = await readFile(join(dir, "model-hub.config.json"), "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(parsed["port"]).toBe(11500);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("default file contains host 127.0.0.1, empty backends and fallbackChain", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mhc-test-"));
    try {
      await initModelHubConfig(dir);
      const raw = await readFile(join(dir, "model-hub.config.json"), "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(parsed["host"]).toBe("127.0.0.1");
      expect(parsed["backends"]).toEqual([]);
      expect(parsed["fallbackChain"]).toEqual([]);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("default file includes _managedSchemaVersion", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mhc-test-"));
    try {
      await initModelHubConfig(dir);
      const raw = await readFile(join(dir, "model-hub.config.json"), "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(typeof parsed["_managedSchemaVersion"]).toBe("number");
      expect(parsed["_managedSchemaVersion"]).toBe(MODEL_HUB_SCHEMA_VERSION);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("returns WriteResult with status created", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mhc-test-"));
    try {
      const result = await initModelHubConfig(dir);
      expect(result.status).toBe("created");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("exports MODEL_HUB_CONFIG_DEFAULTS with expected shape", () => {
    expect(MODEL_HUB_CONFIG_DEFAULTS).toMatchObject({
      port: 11500,
      host: "127.0.0.1",
      backends: [],
      fallbackChain: [],
    });
  });
});

// ---------------------------------------------------------------------------
// AC2: update preserves customizations, adds new fields, bumps schema version
// ---------------------------------------------------------------------------

describe("updateModelHubConfig — AC2: preserves custom config", () => {
  it("preserves existing custom port when update runs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mhc-test-"));
    try {
      const custom = {
        port: 9999,
        host: "0.0.0.0",
        backends: ["ollama"],
        fallbackChain: ["ollama"],
        _managedSchemaVersion: 1,
      };
      await writeFile(
        join(dir, "model-hub.config.json"),
        JSON.stringify(custom, null, 2),
        "utf-8",
      );

      await updateModelHubConfig(dir);

      const raw = await readFile(join(dir, "model-hub.config.json"), "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(parsed["port"]).toBe(9999);
      expect(parsed["host"]).toBe("0.0.0.0");
      expect(parsed["backends"]).toEqual(["ollama"]);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("updates _managedSchemaVersion on update", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mhc-test-"));
    try {
      const custom = {
        port: 11500,
        host: "127.0.0.1",
        backends: [],
        fallbackChain: [],
        _managedSchemaVersion: 0,
      };
      await writeFile(
        join(dir, "model-hub.config.json"),
        JSON.stringify(custom, null, 2),
        "utf-8",
      );

      await updateModelHubConfig(dir);

      const raw = await readFile(join(dir, "model-hub.config.json"), "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(parsed["_managedSchemaVersion"]).toBe(MODEL_HUB_SCHEMA_VERSION);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("adds missing default fields without overwriting existing ones", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mhc-test-"));
    try {
      // File missing fallbackChain (older schema)
      const partial = {
        port: 9001,
        host: "127.0.0.1",
        backends: [],
        _managedSchemaVersion: 0,
      };
      await writeFile(
        join(dir, "model-hub.config.json"),
        JSON.stringify(partial, null, 2),
        "utf-8",
      );

      await updateModelHubConfig(dir);

      const raw = await readFile(join(dir, "model-hub.config.json"), "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(parsed["port"]).toBe(9001); // preserved
      expect(parsed["fallbackChain"]).toEqual([]); // added with default
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("returns WriteResult with status updated", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mhc-test-"));
    try {
      await initModelHubConfig(dir);
      const result = await updateModelHubConfig(dir);
      expect(result.status).toBe("updated");
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
