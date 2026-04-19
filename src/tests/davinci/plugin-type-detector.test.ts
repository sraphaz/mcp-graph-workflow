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
import type { TargetSdkMode } from "../../core/davinci/plugin-type-detector.js";
import { parseDaVinciCode } from "../../core/davinci/davinci-parser.js";

function detect(code: string, mode: TargetSdkMode, override?: string) {
  const analysis = parseDaVinciCode(code);
  return detectPluginType(analysis, mode, { sourceCode: code, override });
}

// ── Fixtures ──────────────────────────────────────────────────────────

const CODE_FETCH_API = `module.exports = a = async ({params}) => {
  const response = await fetch("https://api.example.com/auth", { method: "POST" });
  return { authenticated: true };
}`;

const CODE_JWT_TOKEN = `module.exports = a = async ({params}) => {
  const token = jwt.sign({ sub: params.userId }, params.secret);
  return { token };
}`;

const CODE_STORAGE = `module.exports = a = async ({params}) => {
  await database.save({ userId: params.userId, grant: params.accessGrant });
  const stored = await database.getByClientId(params.clientId);
  return { stored };
}`;

const CODE_WEBHOOK = `module.exports = a = async ({params}) => {
  await fetch("https://hooks.example.com/notify", { method: "POST" });
  return { notified: true, event: "notification" };
}`;

const CODE_PASSWORD = `module.exports = a = async ({params}) => {
  const valid = await authenticate(params.credential, params.password);
  return { authenticated: valid };
}`;

const CODE_SECRET_VAULT = `module.exports = a = async ({params}) => {
  const secret = await getenv("API_SECRET");
  const vaultKey = environment.get("VAULT_KEY");
  return { secret };
}`;

const CODE_DATA_STORE = `module.exports = a = async ({params}) => {
  const result = await ldap.search("ou=users,dc=example", params.filter);
  const user = await db.query("SELECT * FROM users WHERE id = ?", [params.userId]);
  return { user };
}`;

const CODE_SIMPLE = `module.exports = a = async ({params}) => {
  return { hello: "world" };
}`;

const CODE_AMBIGUOUS = `module.exports = a = async ({params}) => {
  const token = jwt.sign({ sub: params.userId }, params.secret);
  const response = await fetch("https://api.example.com/validate");
  const valid = authenticate(params.credential, params.password);
  await database.save({ token });
  return { token, validated: true };
}`;

const CODE_HTTP_RULE = `module.exports = a = async ({params}) => {
  const header = httpRequest.getHeader("Authorization");
  if (!header) { return { allowed: false, statusCode: 401 }; }
  return { allowed: true };
}`;

const CODE_IDENTITY_MAPPING = `module.exports = a = async ({params}) => {
  const decoded = JSON.parse(Buffer.from(params.accessToken.split('.')[1], 'base64').toString());
  const subject = decoded.sub;
  const mappedIdentity = { username: subject };
  return { identity: mappedIdentity };
}`;

// ── Tests ─────────────────────────────────────────────────────────────

describe("plugin-type-detector", () => {
  describe("PingFederate mode", () => {
    it("should detect idp-adapter for HTTP API calls", () => {
      const result = detect(CODE_FETCH_API, "pingfederate");
      expect(result.pluginType).toBe("idp-adapter");
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it("should detect token-generator for JWT sign patterns", () => {
      const result = detect(CODE_JWT_TOKEN, "pingfederate");
      expect(result.pluginType).toBe("token-generator");
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it("should detect access-grant-manager for storage patterns", () => {
      const result = detect(CODE_STORAGE, "pingfederate");
      expect(result.pluginType).toBe("access-grant-manager");
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    });

    it("should detect notification-publisher for webhook/notify patterns", () => {
      const result = detect(CODE_WEBHOOK, "pingfederate");
      expect(result.pluginType).toBe("notification-publisher");
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    });

    it("should detect password-credential-validator for password patterns", () => {
      const result = detect(CODE_PASSWORD, "pingfederate");
      expect(result.pluginType).toBe("password-credential-validator");
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it("should detect secret-manager for vault/env patterns", () => {
      const result = detect(CODE_SECRET_VAULT, "pingfederate");
      expect(result.pluginType).toBe("secret-manager");
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    });

    it("should detect custom-data-store for LDAP/DB query patterns", () => {
      const result = detect(CODE_DATA_STORE, "pingfederate");
      expect(result.pluginType).toBe("custom-data-store");
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    });

    it("should fallback to idp-adapter for simple code without signals", () => {
      const result = detect(CODE_SIMPLE, "pingfederate");
      expect(result.pluginType).toBe("idp-adapter");
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });
  });

  describe("PingAccess mode", () => {
    it("should detect rule for HTTP request/response manipulation", () => {
      const result = detect(CODE_HTTP_RULE, "pingaccess");
      expect(result.pluginType).toBe("rule");
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    });

    it("should detect identity-mapping for token extraction patterns", () => {
      const result = detect(CODE_IDENTITY_MAPPING, "pingaccess");
      expect(result.pluginType).toBe("identity-mapping");
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    });

    it("should fallback to rule for simple code", () => {
      const result = detect(CODE_SIMPLE, "pingaccess");
      expect(result.pluginType).toBe("rule");
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });
  });

  describe("ambiguous cases", () => {
    it("should return warnings for ambiguous code with multiple signals", () => {
      const result = detect(CODE_AMBIGUOUS, "pingfederate");
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should allow manual override", () => {
      const result = detect(CODE_FETCH_API, "pingfederate", "token-generator");
      expect(result.pluginType).toBe("token-generator");
      expect(result.confidence).toBe(1);
    });
  });

  describe("confidence scoring", () => {
    it("should return confidence between 0 and 1", () => {
      const result = detect(CODE_FETCH_API, "pingfederate");
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should return higher confidence for strong single signals", () => {
      const result = detect(CODE_PASSWORD, "pingfederate");
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });
});
