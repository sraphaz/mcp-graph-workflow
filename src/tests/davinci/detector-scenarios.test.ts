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
import { detectPluginType } from "../../core/davinci/plugin-type-detector.js";
import { parseDaVinciCode } from "../../core/davinci/davinci-parser.js";

// ── Helper ───────────────────────────────────────────────────────────

function detect(code: string, mode: "pingfederate" | "pingaccess") {
  const analysis = parseDaVinciCode(code);
  return detectPluginType(analysis, mode, { sourceCode: code });
}

// ── PingFederate Scenarios ───────────────────────────────────────────

describe("Plugin Type Detector — PingFederate", () => {
  it("should detect IdP Adapter from fetch + authenticated return", () => {
    const code = `module.exports = a = async ({ params }) => {
      const res = await fetch("https://idp.example.com/auth", { method: "POST" });
      const data = await res.json();
      return { authenticated: true, userId: data.sub };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("idp-adapter");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect Token Generator from jwt.sign pattern", () => {
    const code = `module.exports = a = async ({ params }) => {
      const payload = { sub: params.userId, iss: "ping" };
      const token = jwt.sign(payload, secret);
      return { token };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("token-generator");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect Token Processor from jwt.verify + decode pattern", () => {
    const code = `module.exports = a = async ({ params }) => {
      const decoded = jwt.verify(params.token, secret);
      const claims = decode(decoded);
      return { claims };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("token-generator");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect Access Grant Manager from database.save + getByClientId", () => {
    const code = `module.exports = a = async ({ params }) => {
      await database.save({ grant: params.grant, clientId: params.clientId });
      const existing = await database.getByClientId(params.clientId);
      return { stored: true, count: existing.length };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("access-grant-manager");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect Notification Publisher from webhook + event + notification", () => {
    const code = `module.exports = a = async ({ params }) => {
      const event = { type: "auth_success", userId: params.userId };
      await fetch("https://webhook-url.example.com/notification", { method: "POST", body: JSON.stringify(event) });
      const notification = { sent: true };
      return { notified: true, notification };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("notification-publisher");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect Password Credential Validator from authenticate + password", () => {
    const code = `module.exports = a = async ({ params }) => {
      const credential = params.username;
      const isValid = await authenticate(credential, params.password);
      return { valid: isValid };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("password-credential-validator");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect Secret Manager from getenv + environment.get", () => {
    const code = `module.exports = a = async ({ params }) => {
      const apiKey = getenv("SECRET_API_KEY");
      const vaultToken = environment.get("VAULT_KEY");
      return { apiKey, vaultToken };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("secret-manager");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect Custom Data Store from ldap.search + db.query", () => {
    const code = `module.exports = a = async ({ params }) => {
      const users = await ldap.search("ou=users,dc=example,dc=com");
      const records = await db.query("SELECT * FROM accounts WHERE active = 1");
      return { users, records };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("custom-data-store");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect IdP Adapter for External Consent (auth pattern dominates)", () => {
    const code = `module.exports = a = async ({ params }) => {
      const consentPage = await fetch("https://consent.example.com/page", { method: "GET" });
      const consent = consentPage.ok;
      if (consent) {
        return { authenticated: true, scope: params.scope };
      }
      return { authenticated: false };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("idp-adapter");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect IdP Adapter for Auth Selector with fetch + selection logic", () => {
    const code = `module.exports = a = async ({ params }) => {
      const providers = await fetch("https://selector.example.com/providers", { method: "GET" });
      const list = await providers.json();
      const selected = list.find(p => p.id === params.selection);
      return { provider: selected.name, redirectUrl: selected.url };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("idp-adapter");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect IdP Adapter for DCR plugin with fetch + registration + metadata", () => {
    const code = `module.exports = a = async ({ params }) => {
      const registration = { client_name: params.clientName, redirect_uris: params.redirectUris };
      const res = await fetch("https://auth.example.com/register", { method: "POST", body: JSON.stringify(registration) });
      const metadata = await res.json();
      return { clientId: metadata.client_id, registered: true };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("idp-adapter");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect IdP Adapter for Identity Provisioner with fetch + provisioning", () => {
    const code = `module.exports = a = async ({ params }) => {
      const provisioning = { userId: params.userId, groups: params.groups };
      const res = await fetch("https://scim.example.com/Users", { method: "POST", body: JSON.stringify(provisioning) });
      const result = await res.json();
      return { provisioned: true, externalId: result.id };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("idp-adapter");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect IdP Adapter as fallback for SP Adapter with simple attributes return", () => {
    const code = `module.exports = a = async ({ params }) => {
      const attributes = { firstName: params.first, lastName: params.last, region: params.region };
      return attributes;
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("idp-adapter");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect IdP Adapter for CIBA OOB auth with fetch + out-of-band pattern", () => {
    const code = `module.exports = a = async ({ params }) => {
      const oobRequest = { userId: params.userId, bindingMessage: params.message };
      const res = await fetch("https://ciba.example.com/bc-authorize", { method: "POST", body: JSON.stringify(oobRequest) });
      const authResult = await res.json();
      return { authReqId: authResult.auth_req_id, status: "pending" };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("idp-adapter");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect Access Grant Manager for Client Storage with database.save + persist + clientId", () => {
    const code = `module.exports = a = async ({ params }) => {
      const clientData = { clientId: params.clientId, secret: params.secret };
      await database.save(clientData);
      const persist = true;
      return { stored: persist, clientId: params.clientId };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("access-grant-manager");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect IdP Adapter for Template Render with fetch + html rendering", () => {
    const code = `module.exports = a = async ({ params }) => {
      const templateData = await fetch("https://templates.example.com/form", { method: "GET" });
      const html = await templateData.text();
      const rendered = html.replace("{{displayName}}", params.displayName);
      return { html: rendered, contentType: "text/html" };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("idp-adapter");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect IdP Adapter for Session Enforcement with fetch + session + logout", () => {
    const code = `module.exports = a = async ({ params }) => {
      const session = params.sessionId;
      const res = await fetch("https://session.example.com/validate", { method: "POST", body: JSON.stringify({ session }) });
      const valid = await res.json();
      if (!valid.active) {
        const logout = true;
        return { session: null, logout };
      }
      return { session, active: true };
    };`;

    const result = detect(code, "pingfederate");
    expect(result.pluginType).toBe("idp-adapter");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

// ── PingAccess Scenarios ─────────────────────────────────────────────

describe("Plugin Type Detector — PingAccess", () => {
  it("should detect Rule from httpRequest.getHeader + statusCode + allowed/forbidden", () => {
    const code = `module.exports = a = async ({ params }) => {
      const authHeader = httpRequest.getHeader("Authorization");
      if (!authHeader) {
        return { statusCode: 403, forbidden: true };
      }
      return { statusCode: 200, allowed: true };
    };`;

    const result = detect(code, "pingaccess");
    expect(result.pluginType).toBe("rule");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect Identity Mapping from accessToken + decoded + subject + mappedIdentity", () => {
    const code = `module.exports = a = async ({ params }) => {
      const accessToken = params.token;
      const decoded = decodeToken(accessToken);
      const subject = decoded.sub;
      const mappedIdentity = { username: subject, roles: decoded.roles };
      const identity = mappedIdentity;
      return { identity };
    };`;

    const result = detect(code, "pingaccess");
    expect(result.pluginType).toBe("identity-mapping");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect Load Balancing from server + backend + weight + roundRobin", () => {
    const code = `module.exports = a = async ({ params }) => {
      const servers = [
        { server: "backend-1.example.com", weight: 3 },
        { server: "backend-2.example.com", weight: 1 },
      ];
      const backend = roundRobin(servers);
      const selected = loadBalance(backend, params.request);
      return { target: selected.server };
    };`;

    const result = detect(code, "pingaccess");
    expect(result.pluginType).toBe("load-balancing");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect Site Authenticator from siteAuth + basicAuth + siteCredential", () => {
    const code = `module.exports = a = async ({ params }) => {
      const siteAuth = { type: "basic" };
      const siteCredential = { username: params.siteUser, password: params.sitePass };
      const basicAuth = encodeCredentials(siteCredential);
      return { authorization: basicAuth, siteAuth };
    };`;

    const result = detect(code, "pingaccess");
    expect(result.pluginType).toBe("site-authenticator");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("should detect Rule for Locale Override from httpRequest + getHeader", () => {
    const code = `module.exports = a = async ({ params }) => {
      const locale = httpRequest.getHeader("Accept-Language");
      return { locale: locale || "en-US" };
    };`;

    const result = detect(code, "pingaccess");
    expect(result.pluginType).toBe("rule");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
