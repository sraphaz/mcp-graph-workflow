import { describe, it, expect } from "vitest";
import {
  generateGuiDescriptor,
  generateAttributeContract,
  generatePfInfDescriptor,
  generateMetaInfServices,
} from "../../core/davinci/descriptor-generator.js";
import type { DaVinciVariable } from "../../core/davinci/davinci-types.js";

function makeVar(fieldName: string, kind: DaVinciVariable["kind"] = "global"): DaVinciVariable {
  return {
    kind,
    rawTemplate: `{{global.variables.${fieldName}}}`,
    path: ["global", "variables", fieldName],
    fieldName,
  };
}

describe("descriptor-generator", () => {
  describe("generateGuiDescriptor", () => {
    it("should generate TextFieldDescriptor for global variables", () => {
      const result = generateGuiDescriptor([makeVar("apiKey"), makeVar("baseUrl")]);

      expect(result.fieldDeclarations).toContain("TextFieldDescriptor apiKeyField");
      expect(result.fieldDeclarations).toContain("TextFieldDescriptor baseUrlField");
      expect(result.fieldRegistrations).toContain("guiDescriptor.addField(apiKeyField)");
      expect(result.fieldRegistrations).toContain("guiDescriptor.addField(baseUrlField)");
    });

    it("should generate instance fields for each variable", () => {
      const result = generateGuiDescriptor([makeVar("apiKey")]);

      expect(result.instanceFields).toContain("private String apiKey;");
    });

    it("should skip local variables", () => {
      const result = generateGuiDescriptor([
        makeVar("apiKey", "global"),
        { kind: "local", rawTemplate: "{{local.node.cap.output.userId}}", path: ["local", "node", "cap", "output", "userId"], fieldName: "userId", nodeId: "node", capability: "cap" },
      ]);

      expect(result.fieldDeclarations).toContain("apiKey");
      expect(result.fieldDeclarations).not.toContain("userId");
    });

    it("should deduplicate variables with same fieldName", () => {
      const result = generateGuiDescriptor([makeVar("apiKey"), makeVar("apiKey")]);

      const count = (result.fieldDeclarations.match(/apiKeyField/g) || []).length;
      expect(count).toBe(1);
    });

    it("should return empty strings for no variables", () => {
      const result = generateGuiDescriptor([]);

      expect(result.fieldDeclarations).toBe("");
      expect(result.fieldRegistrations).toBe("");
      expect(result.instanceFields).toBe("");
    });
  });

  describe("generateAttributeContract", () => {
    it("should generate Set<String> with contract.add for each attribute", () => {
      const result = generateAttributeContract(["username", "email", "role"]);

      expect(result).toContain("new HashSet<>()");
      expect(result).toContain('contract.add("username")');
      expect(result).toContain('contract.add("email")');
      expect(result).toContain('contract.add("role")');
    });

    it("should handle empty contract", () => {
      const result = generateAttributeContract([]);

      expect(result).toContain("new HashSet<>()");
      expect(result).not.toContain("contract.add");
    });
  });

  describe("generatePfInfDescriptor", () => {
    it("should map idp-adapter to idp-authn-adapters", () => {
      const result = generatePfInfDescriptor("idp-adapter", "com.example", "MyAdapter");

      expect(result.directoryName).toBe("idp-authn-adapters");
      expect(result.content).toBe("com.example.MyAdapter");
      expect(result.fullPath).toBe("PF-INF/idp-authn-adapters");
    });

    it("should map token-generator to token-generators", () => {
      const result = generatePfInfDescriptor("token-generator", "com.example", "MyGen");

      expect(result.directoryName).toBe("token-generators");
      expect(result.content).toBe("com.example.MyGen");
    });

    it("should map notification-publisher to notification-publishers", () => {
      const result = generatePfInfDescriptor("notification-publisher", "com.example", "MyPub");

      expect(result.directoryName).toBe("notification-publishers");
    });

    it("should map secret-manager to secret-managers", () => {
      const result = generatePfInfDescriptor("secret-manager", "com.example", "MyMgr");

      expect(result.directoryName).toBe("secret-managers");
    });

    it("should use plugin type as fallback for unknown types", () => {
      const result = generatePfInfDescriptor("custom-unknown", "com.example", "MyPlugin");

      expect(result.directoryName).toBe("custom-unknown");
    });

    it("should map access-grant-manager to access-grant-managers", () => {
      const result = generatePfInfDescriptor("access-grant-manager", "com.example", "MyGrantMgr");

      expect(result.directoryName).toBe("access-grant-managers");
      expect(result.content).toBe("com.example.MyGrantMgr");
    });

    it("should map password-credential-validator to password-credential-validators", () => {
      const result = generatePfInfDescriptor("password-credential-validator", "com.example", "MyPcv");

      expect(result.directoryName).toBe("password-credential-validators");
      expect(result.content).toBe("com.example.MyPcv");
    });

    it("should map custom-data-store to custom-data-stores", () => {
      const result = generatePfInfDescriptor("custom-data-store", "com.example", "MyStore");

      expect(result.directoryName).toBe("custom-data-stores");
      expect(result.content).toBe("com.example.MyStore");
    });

    it("should map token-processor to token-processors", () => {
      const result = generatePfInfDescriptor("token-processor", "com.example", "MyProcessor");

      expect(result.directoryName).toBe("token-processors");
      expect(result.content).toBe("com.example.MyProcessor");
    });
  });

  describe("generateMetaInfServices", () => {
    it("should generate META-INF/services path and FQCN content", () => {
      const result = generateMetaInfServices(
        "com.pingidentity.pa.sdk.policy.RuleInterceptor",
        "com.example.rules",
        "MyRule",
      );

      expect(result.filePath).toBe("META-INF/services/com.pingidentity.pa.sdk.policy.RuleInterceptor");
      expect(result.content).toBe("com.example.rules.MyRule");
    });
  });
});
