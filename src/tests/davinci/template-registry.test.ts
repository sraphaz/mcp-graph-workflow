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
  getTemplate,
  listTemplates,
  renderTemplate,
} from "../../core/davinci/template-registry.js";
import type { TemplateContext } from "../../core/davinci/template-registry.js";

function makeContext(overrides: Partial<TemplateContext> = {}): TemplateContext {
  return {
    className: "MyPlugin",
    packageName: "com.example.plugin",
    pluginName: "My Plugin",
    guiFields: "",
    configureBody: "",
    mainMethodBody: "",
    attributeContract: ["username"],
    ...overrides,
  };
}

describe("template-registry", () => {
  describe("getTemplate", () => {
    it("should return idp-adapter template for PingFederate", () => {
      const tmpl = getTemplate("idp-adapter", "pingfederate");
      expect(tmpl).toBeDefined();
      expect(tmpl!.interfaceName).toBe("IdpAuthenticationAdapterV2");
      expect(tmpl!.pfInfType).toBe("idp-authn-adapters");
    });

    it("should return token-generator template for PingFederate", () => {
      const tmpl = getTemplate("token-generator", "pingfederate");
      expect(tmpl).toBeDefined();
      expect(tmpl!.interfaceName).toBe("TokenGenerator");
      expect(tmpl!.imports).toContain("org.sourceid.wstrust.plugin.generate.TokenGenerator");
    });

    it("should return token-processor template for PingFederate", () => {
      const tmpl = getTemplate("token-processor", "pingfederate");
      expect(tmpl).toBeDefined();
      expect(tmpl!.interfaceName).toContain("TokenProcessor");
    });

    it("should return notification-publisher template for PingFederate", () => {
      const tmpl = getTemplate("notification-publisher", "pingfederate");
      expect(tmpl).toBeDefined();
      expect(tmpl!.interfaceName).toBe("NotificationPublisherPlugin");
    });

    it("should return secret-manager template for PingFederate", () => {
      const tmpl = getTemplate("secret-manager", "pingfederate");
      expect(tmpl).toBeDefined();
      expect(tmpl!.interfaceName).toBe("SecretManager");
    });

    it("should return password-credential-validator template for PingFederate", () => {
      const tmpl = getTemplate("password-credential-validator", "pingfederate");
      expect(tmpl).toBeDefined();
      expect(tmpl!.interfaceName).toBe("PasswordCredentialValidator");
    });

    it("should return rule template for PingAccess", () => {
      const tmpl = getTemplate("rule", "pingaccess");
      expect(tmpl).toBeDefined();
      expect(tmpl!.interfaceName).toBe("RuleInterceptorBase");
    });

    it("should return identity-mapping template for PingAccess", () => {
      const tmpl = getTemplate("identity-mapping", "pingaccess");
      expect(tmpl).toBeDefined();
      expect(tmpl!.interfaceName).toBe("IdentityMappingPluginBase");
    });

    it("should return undefined for unknown plugin type", () => {
      const tmpl = getTemplate("nonexistent", "pingfederate");
      expect(tmpl).toBeUndefined();
    });
  });

  describe("listTemplates", () => {
    it("should list 6+ PingFederate templates", () => {
      const templates = listTemplates("pingfederate");
      expect(templates.length).toBeGreaterThanOrEqual(6);
    });

    it("should list 3 PingAccess templates", () => {
      const templates = listTemplates("pingaccess");
      expect(templates.length).toBe(3);
    });
  });

  describe("renderTemplate - PingFederate", () => {
    it("should render Java class with correct package and class name", () => {
      const tmpl = getTemplate("idp-adapter", "pingfederate")!;
      const java = renderTemplate(tmpl, makeContext());

      expect(java).toContain("package com.example.plugin;");
      expect(java).toContain("public class MyPlugin");
    });

    it("should include imports from template", () => {
      const tmpl = getTemplate("idp-adapter", "pingfederate")!;
      const java = renderTemplate(tmpl, makeContext());

      expect(java).toContain("import com.pingidentity.sdk.IdpAuthenticationAdapterV2;");
      expect(java).toContain("import javax.servlet.http.HttpServletRequest;");
    });

    it("should include implements clause", () => {
      const tmpl = getTemplate("idp-adapter", "pingfederate")!;
      const java = renderTemplate(tmpl, makeContext());

      expect(java).toContain("implements IdpAuthenticationAdapterV2");
    });

    it("should include configure() method", () => {
      const tmpl = getTemplate("idp-adapter", "pingfederate")!;
      const java = renderTemplate(tmpl, makeContext({
        configureBody: '        this.apiKey = configuration.getFieldValue("apiKey");',
      }));

      expect(java).toContain("public void configure(Configuration configuration)");
      expect(java).toContain('configuration.getFieldValue("apiKey")');
    });

    it("should include attribute contract", () => {
      const tmpl = getTemplate("idp-adapter", "pingfederate")!;
      const java = renderTemplate(tmpl, makeContext({
        attributeContract: ["username", "email"],
      }));

      expect(java).toContain('contract.add("username")');
      expect(java).toContain('contract.add("email")');
    });

    it("should include getPluginDescriptor method", () => {
      const tmpl = getTemplate("idp-adapter", "pingfederate")!;
      const java = renderTemplate(tmpl, makeContext());

      expect(java).toContain("getPluginDescriptor()");
      expect(java).toContain("return descriptor");
    });

    it("should include main method signature", () => {
      const tmpl = getTemplate("token-generator", "pingfederate")!;
      const java = renderTemplate(tmpl, makeContext());

      expect(java).toContain("generateToken");
      expect(java).toContain("TokenContext");
    });
  });

  describe("renderTemplate - PingAccess", () => {
    it("should render PingAccess class with extends", () => {
      const tmpl = getTemplate("rule", "pingaccess")!;
      const java = renderTemplate(tmpl, makeContext());

      expect(java).toContain("extends RuleInterceptorBase");
      expect(java).toContain("@Rule");
    });

    it("should include PingAccess imports", () => {
      const tmpl = getTemplate("rule", "pingaccess")!;
      const java = renderTemplate(tmpl, makeContext());

      expect(java).toContain("import com.pingidentity.pa.sdk.policy.RuleInterceptorBase;");
    });

    it("should include nested Configuration class", () => {
      const tmpl = getTemplate("rule", "pingaccess")!;
      const java = renderTemplate(tmpl, makeContext());

      expect(java).toContain("Configuration");
    });
  });

  describe("placeholder substitution", () => {
    it("should substitute className in rendered output", () => {
      const tmpl = getTemplate("idp-adapter", "pingfederate")!;
      const java = renderTemplate(tmpl, makeContext({ className: "CustomAuthAdapter" }));

      expect(java).toContain("public class CustomAuthAdapter");
      expect(java).toContain("public CustomAuthAdapter()");
    });

    it("should substitute packageName in rendered output", () => {
      const tmpl = getTemplate("idp-adapter", "pingfederate")!;
      const java = renderTemplate(tmpl, makeContext({ packageName: "com.acme.auth" }));

      expect(java).toContain("package com.acme.auth;");
    });

    it("should substitute mainMethodBody", () => {
      const tmpl = getTemplate("idp-adapter", "pingfederate")!;
      const java = renderTemplate(tmpl, makeContext({
        mainMethodBody: '        String ip = req.getRemoteAddr();\n        return AuthnAdapterResponse.SUCCESS;',
      }));

      expect(java).toContain("req.getRemoteAddr()");
    });
  });
});
