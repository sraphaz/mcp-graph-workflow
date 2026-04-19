/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { describe, it, expect } from "vitest";
import {
  checkBuildEnvironment,
  scaffoldMavenProject,
  runMavenBuild,
} from "../../core/davinci/build-runner.js";
import type { BuildResult as _BuildResult } from "../../core/davinci/davinci-types.js";

// ── Environment Detection Tests ───────────────────────────────────────

describe("build-runner", () => {
  describe("checkBuildEnvironment", () => {
    it("should return environment status object", () => {
      const env = checkBuildEnvironment();

      expect(env).toBeDefined();
      expect(typeof env.jdkAvailable).toBe("boolean");
      expect(typeof env.mavenAvailable).toBe("boolean");
      expect(typeof env.sdkAvailable).toBe("boolean");
    });

    it("should detect JDK version when available", () => {
      const env = checkBuildEnvironment();

      if (env.jdkAvailable) {
        expect(env.jdkVersion).toBeDefined();
        expect(env.jdkVersion!.length).toBeGreaterThan(0);
      }
    });

    it("should detect Maven version when available", () => {
      const env = checkBuildEnvironment();

      if (env.mavenAvailable) {
        expect(env.mavenVersion).toBeDefined();
        expect(env.mavenVersion!.length).toBeGreaterThan(0);
      }
    });

    it("should report readyToBuild only when JDK and Maven are available", () => {
      const env = checkBuildEnvironment();

      if (env.jdkAvailable && env.mavenAvailable) {
        expect(env.readyToBuild).toBe(true);
      } else {
        expect(env.readyToBuild).toBe(false);
      }
    });

    it("should return items array with name, available, and installUrl for each requirement", () => {
      const env = checkBuildEnvironment();

      expect(env.items).toBeDefined();
      expect(env.items.length).toBe(3);

      const names = env.items.map((i) => i.name);
      expect(names).toContain("JDK");
      expect(names).toContain("Maven");
      expect(names).toContain("PingAccess SDK");

      for (const item of env.items) {
        expect(typeof item.available).toBe("boolean");
        if (!item.available) {
          expect(item.installUrl).toBeDefined();
          expect(item.instruction).toBeDefined();
        }
      }
    });

    it("should include instructions for missing tools", () => {
      const env = checkBuildEnvironment();

      expect(env.instructions).toBeDefined();
      expect(Array.isArray(env.instructions)).toBe(true);

      if (!env.jdkAvailable) {
        const jdkInstruction = env.instructions.find((i: string) =>
          i.toLowerCase().includes("jdk")
        );
        expect(jdkInstruction).toBeDefined();
      }

      if (!env.mavenAvailable) {
        const mvnInstruction = env.instructions.find((i: string) =>
          i.toLowerCase().includes("maven")
        );
        expect(mvnInstruction).toBeDefined();
      }
    });
  });

  describe("scaffoldMavenProject", () => {
    it("should create Maven directory structure", async () => {
      const result = await scaffoldMavenProject({
        outputDir: "/tmp/davinci-test-" + Date.now(),
        javaCode: 'public class Test { }',
        pomXml: '<project></project>',
        packageName: "com.example.test",
        className: "Test",
        pfInfContent: "com.example.test.Test",
        pfInfType: "idp-authn-adapters",
      });

      expect(result.pomPath).toContain("pom.xml");
      expect(result.javaPath).toContain("Test.java");
      expect(result.projectDir).toBeDefined();
    });

    it("should place Java file in correct package directory", async () => {
      const result = await scaffoldMavenProject({
        outputDir: "/tmp/davinci-test-" + Date.now(),
        javaCode: 'public class MyPlugin { }',
        pomXml: '<project></project>',
        packageName: "com.pingidentity.plugin",
        className: "MyPlugin",
      });

      const normalizedPath = result.javaPath.replace(/\\/g, "/");
      expect(normalizedPath).toContain("com/pingidentity/plugin/MyPlugin.java");
    });
  });

  describe("runMavenBuild", () => {
    it("should return BuildResult with success false when Maven not available", async () => {
      const env = checkBuildEnvironment();

      if (!env.mavenAvailable) {
        const result = await runMavenBuild("/nonexistent/path");

        expect(result.success).toBe(false);
        expect(result.stderr).toContain("Maven");
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it("should return BuildResult with correct shape", async () => {
      const result = await runMavenBuild("/nonexistent/path");

      expect(typeof result.success).toBe("boolean");
      expect(typeof result.stdout).toBe("string");
      expect(typeof result.stderr).toBe("string");
      expect(typeof result.durationMs).toBe("number");
    });

    it("should handle missing POM gracefully", async () => {
      const result = await runMavenBuild("/tmp/no-pom-here-" + Date.now());

      expect(result.success).toBe(false);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
