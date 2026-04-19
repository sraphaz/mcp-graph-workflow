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
import { generatePom } from "../../core/davinci/pom-generator.js";
import type { PluginGenerationConfig } from "../../core/davinci/davinci-types.js";

function makeConfig(overrides: Partial<PluginGenerationConfig> = {}): PluginGenerationConfig {
  return {
    pluginName: "my-davinci-plugin",
    packageName: "com.example.plugin",
    className: "MyDaVinciPlugin",
    pluginType: "idp-adapter",
    attributeContract: ["username", "email"],
    javaVersion: "11",
    ...overrides,
  };
}

describe("pom-generator", () => {
  describe("PingFederate POM", () => {
    it("should generate valid XML with project declaration", () => {
      const pom = generatePom(makeConfig(), "pingfederate");

      expect(pom).toContain('<?xml version="1.0"');
      expect(pom).toContain("<project");
      expect(pom).toContain("</project>");
    });

    it("should include artifactId from pluginName", () => {
      const pom = generatePom(makeConfig({ pluginName: "my-custom-adapter" }), "pingfederate");

      expect(pom).toContain("<artifactId>my-custom-adapter</artifactId>");
    });

    it("should include systemPath dependencies for SDK JARs", () => {
      const pom = generatePom(makeConfig({ sdkPath: "/opt/sdk" }), "pingfederate");

      expect(pom).toContain("<systemPath>");
      expect(pom).toContain("<scope>system</scope>");
    });

    it("should include maven-compiler-plugin", () => {
      const pom = generatePom(makeConfig(), "pingfederate");

      expect(pom).toContain("maven-compiler-plugin");
    });

    it("should include maven-jar-plugin with PF-INF resources", () => {
      const pom = generatePom(makeConfig(), "pingfederate");

      expect(pom).toContain("maven-jar-plugin");
    });
  });

  describe("PingAccess POM", () => {
    it("should include pingaccess-sdk dependency 9.0.1.0", () => {
      const pom = generatePom(makeConfig(), "pingaccess");

      expect(pom).toContain("pingaccess-sdk");
      expect(pom).toContain("9.0.1.0");
    });

    it("should include Jakarta validation and inject dependencies", () => {
      const pom = generatePom(makeConfig(), "pingaccess");

      expect(pom).toContain("jakarta.validation-api");
      expect(pom).toContain("3.1.1");
      expect(pom).toContain("jakarta.inject-api");
      expect(pom).toContain("2.0.1");
    });

    it("should include PingIdentity Maven repository", () => {
      const pom = generatePom(makeConfig(), "pingaccess");

      expect(pom).toContain("maven.pingidentity.com/release");
    });

    it("should use Java 17 for compiler", () => {
      const pom = generatePom(makeConfig({ javaVersion: "17" }), "pingaccess");

      expect(pom).toContain("<source>17</source>");
      expect(pom).toContain("<target>17</target>");
    });

    it("should include maven-antrun-plugin for deploy copy", () => {
      const pom = generatePom(makeConfig(), "pingaccess");

      expect(pom).toContain("maven-antrun-plugin");
      expect(pom).toContain("deploy");
    });

    it("should include surefire plugin with add-opens for Java 17", () => {
      const pom = generatePom(makeConfig({ javaVersion: "17" }), "pingaccess");

      expect(pom).toContain("maven-surefire-plugin");
      expect(pom).toContain("--add-opens");
    });

    it("should use groupId com.pingidentity.pingaccess", () => {
      const pom = generatePom(makeConfig(), "pingaccess");

      expect(pom).toContain("<groupId>com.pingidentity.pingaccess</groupId>");
    });
  });

  describe("common features", () => {
    it("should include version 1.0.0 by default", () => {
      const pfPom = generatePom(makeConfig(), "pingfederate");
      const paPom = generatePom(makeConfig(), "pingaccess");

      expect(pfPom).toContain("<version>1.0.0</version>");
      expect(paPom).toContain("<version>1.0.0</version>");
    });

    it("should include packaging as jar", () => {
      const pom = generatePom(makeConfig(), "pingaccess");

      expect(pom).toContain("<packaging>jar</packaging>");
    });
  });
});
