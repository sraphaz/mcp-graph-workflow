import { describe, it, expect } from "vitest";
import { generatePlugin } from "../../core/davinci/plugin-generator.js";
import { validatePreConversion, validatePostGeneration } from "../../core/davinci/davinci-validators.js";
import { parseDaVinciCode } from "../../core/davinci/davinci-parser.js";

const BASE_OPTIONS = {
  pluginName: "TestPlugin",
  packageName: "com.example.test",
  className: "TestPlugin",
  targetSdk: "pingfederate" as const,
};

describe("e2e-scenarios", () => {
  it("should process auth adapter pipeline with fetch + auth code", () => {
    const code = `
      module.exports = a = async ({params}) => {
        const apiKey = "{{global.variables.apiKey}}";
        const resp = await fetch("https://idp.example.com/authn", {
          method: "POST",
          headers: { "Authorization": "Bearer " + apiKey },
          body: JSON.stringify({ username: params.username })
        });
        const data = await resp.json();
        return { userId: data.id, displayName: data.name };
      };
    `;

    const result = generatePlugin({
      ...BASE_OPTIONS,
      code,
    });

    expect(result.javaCode).toContain("IdpAuthenticationAdapterV2");
    expect(result.pomXml).toContain("<project");
    expect(result.pfInfType).toContain("idp");
  });

  it("should process token generator pipeline with jwt.sign", () => {
    const code = `
      module.exports = a = async ({params}) => {
        const secret = "{{global.variables.jwtSecret}}";
        const payload = { sub: params.userId, iat: Date.now() };
        const token = jwt.sign(payload, secret, { expiresIn: "1h" });
        return { accessToken: token };
      };
    `;

    const result = generatePlugin({
      ...BASE_OPTIONS,
      code,
      pluginType: "token-generator",
    });

    expect(result.javaCode).toContain("TokenGenerator");
    expect(result.pfInfType).toBe("token-generators");
  });

  it("should process PingAccess rule pipeline with httpRequest", () => {
    const code = `
      module.exports = a = async ({params}) => {
        const resp = await httpRequest("https://api.example.com/check", {
          method: "GET",
          headers: { "X-Api-Key": "{{global.variables.apiKey}}" }
        });
        if (resp.status === 200) {
          return { allow: true };
        }
        return { allow: false };
      };
    `;

    const result = generatePlugin({
      ...BASE_OPTIONS,
      code,
      targetSdk: "pingaccess",
      pluginType: "rule",
    });

    expect(result.javaCode).toContain("@Rule");
    expect(result.javaCode).toContain("extends RuleInterceptorBase");
  });

  it("should handle code with warnings through full validation pipeline", () => {
    const code = `
      const fs = require("fs");
      module.exports = a = async ({params}) => {
        const data = fs.readFileSync("/tmp/config.json");
        return JSON.parse(data);
      };
    `;

    const analysis = parseDaVinciCode(code);
    const preValidation = validatePreConversion(code, analysis);

    const issueCodes = preValidation.issues.map((i) => i.code);
    expect(issueCodes).toContain("require_usage");
    expect(issueCodes).toContain("fs_usage");

    const result = generatePlugin({
      ...BASE_OPTIONS,
      code,
    });

    const postValidation = validatePostGeneration(result);
    expect(postValidation.valid).toBe(true);
  });

  it("should process PingAccess identity-mapping pipeline", () => {
    const code = `
      module.exports = a = async ({params}) => {
        const userId = params.subject;
        const mappedIdentity = {
          username: userId,
          roles: ["user", "admin"],
        };
        return mappedIdentity;
      };
    `;

    const result = generatePlugin({
      ...BASE_OPTIONS,
      code,
      targetSdk: "pingaccess",
      pluginType: "identity-mapping",
    });

    expect(result.javaCode).toContain("@IdentityMapping");
  });

  it("should process password validator pipeline with password + authenticate", () => {
    const code = `
      module.exports = a = async ({params}) => {
        const password = params.password;
        const username = params.username;
        const isValid = await authenticate(username, password);
        if (!isValid) {
          throw new Error("Invalid credentials");
        }
        return { authenticated: true, username };
      };
    `;

    const result = generatePlugin({
      ...BASE_OPTIONS,
      code,
      pluginType: "password-credential-validator",
    });

    expect(result.javaCode).toContain("PasswordCredentialValidator");
  });

  it("should allow override of detected plugin type to secret-manager", () => {
    const code = `
      module.exports = a = async ({params}) => {
        const resp = await fetch("https://api.example.com/data", {
          method: "GET",
          headers: { "Authorization": "Bearer " + params.token }
        });
        return await resp.json();
      };
    `;

    const result = generatePlugin({
      ...BASE_OPTIONS,
      code,
      pluginType: "secret-manager",
    });

    expect(result.pluginType).toBe("secret-manager");
    expect(result.confidence).toBe(1);
    expect(result.javaCode).toContain("SecretManager");
  });

  it("should handle empty/minimal code producing a valid plugin", () => {
    const code = `module.exports = a = async ({params}) => { return { ok: true }; }`;

    const result = generatePlugin({
      ...BASE_OPTIONS,
      code,
    });

    expect(result.javaCode).toContain("public class");
    expect(result.analysis.variableCount).toBe(0);
  });
});
