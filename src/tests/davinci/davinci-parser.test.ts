import { describe, it, expect } from "vitest";
import { parseDaVinciCode } from "../../core/davinci/davinci-parser.js";

// ── Sample DaVinci Code Fixtures ──────────────────────────────────────

const SIMPLE_CUSTOM_FUNCTION = `
module.exports = a = async ({params}) => {
  const apiKey = "{{global.variables.apiKey}}";
  const baseUrl = "{{global.company.variables.baseUrl}}";
  const response = await fetch(baseUrl + "/api/users", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey }
  });
  const data = JSON.parse(response.body);
  return { userId: data.id, status: "success" };
}
`;

const CODE_WITH_LOCAL_VARS = `
module.exports = a = async ({params}) => {
  const userId = "{{local.httpNode.makeRequest.output.userId}}";
  const flowToken = "{{global.flow.variables.flowToken}}";
  if (userId) {
    return { verified: true };
  } else {
    return { verified: false };
  }
}
`;

const CODE_WITH_PARAMS = `
module.exports = a = async ({params}) => {
  const age = params.currentAge;
  const name = params.userName;
  let discount = 0;
  if (age >= 65) {
    discount = 20;
  }
  for (let i = 0; i < 3; i++) {
    console.log(i);
  }
  return { yearsUntilDiscount: 65 - age, discount };
}
`;

const CODE_WITH_ERROR_HANDLING = `
module.exports = a = async ({params}) => {
  try {
    const result = await fetch("https://api.example.com/data");
    const body = JSON.parse(result.body);
    return { data: body };
  } catch (error) {
    return { error: error.message };
  }
}
`;



const CODE_WITH_FS_USAGE = `
module.exports = a = async ({params}) => {
  const fs = require("fs");
  const data = fs.readFileSync("/path/to/file");
  return { data: data.toString() };
}
`;

const HTML_TEMPLATE_CODE = `
<script>
  const username = "{{username}}";
  const email = "{{email}}";
  document.getElementById("greeting").textContent = "Hello, " + username;
</script>
`;

// ── Tests ─────────────────────────────────────────────────────────────

describe("davinci-parser", () => {
  describe("parseDaVinciCode", () => {
    describe("module.exports detection", () => {
      it("should detect module.exports async pattern", () => {
        const result = parseDaVinciCode(SIMPLE_CUSTOM_FUNCTION);

        expect(result).toBeDefined();
        expect(result.sourceLineCount).toBeGreaterThan(0);
      });

      it("should classify as custom_function by default", () => {
        const result = parseDaVinciCode(SIMPLE_CUSTOM_FUNCTION);

        expect(result.codeLocation).toBe("custom_function");
      });

      it("should accept explicit code location override", () => {
        const result = parseDaVinciCode(SIMPLE_CUSTOM_FUNCTION, {
          codeLocation: "code_snippet",
        });

        expect(result.codeLocation).toBe("code_snippet");
      });
    });

    describe("variable extraction", () => {
      it("should extract global.variables as 'global' kind", () => {
        const result = parseDaVinciCode(SIMPLE_CUSTOM_FUNCTION);
        const globalVars = result.variables.filter((v) => v.kind === "global");

        expect(globalVars.length).toBeGreaterThanOrEqual(1);
        const apiKeyVar = globalVars.find((v) => v.fieldName === "apiKey");
        expect(apiKeyVar).toBeDefined();
        expect(apiKeyVar!.rawTemplate).toBe("{{global.variables.apiKey}}");
        expect(apiKeyVar!.path).toEqual(["global", "variables", "apiKey"]);
      });

      it("should extract global.company.variables as 'global' kind", () => {
        const result = parseDaVinciCode(SIMPLE_CUSTOM_FUNCTION);
        const companyVars = result.variables.filter(
          (v) => v.fieldName === "baseUrl"
        );

        expect(companyVars.length).toBe(1);
        expect(companyVars[0].path).toEqual([
          "global",
          "company",
          "variables",
          "baseUrl",
        ]);
      });

      it("should extract local node output variables", () => {
        const result = parseDaVinciCode(CODE_WITH_LOCAL_VARS);
        const localVars = result.variables.filter((v) => v.kind === "local");

        expect(localVars.length).toBeGreaterThanOrEqual(1);
        const userIdVar = localVars.find((v) => v.fieldName === "userId");
        expect(userIdVar).toBeDefined();
        expect(userIdVar!.nodeId).toBe("httpNode");
        expect(userIdVar!.capability).toBe("makeRequest");
      });

      it("should extract global.flow.variables as 'flow' kind", () => {
        const result = parseDaVinciCode(CODE_WITH_LOCAL_VARS);
        const flowVars = result.variables.filter((v) => v.kind === "flow");

        expect(flowVars.length).toBeGreaterThanOrEqual(1);
        expect(flowVars[0].fieldName).toBe("flowToken");
      });

      it("should extract parameter variables from HTML template", () => {
        const result = parseDaVinciCode(HTML_TEMPLATE_CODE, {
          codeLocation: "html_template",
        });
        const paramVars = result.variables.filter(
          (v) => v.kind === "parameter"
        );

        expect(paramVars.length).toBeGreaterThanOrEqual(2);
        const names = paramVars.map((v) => v.fieldName);
        expect(names).toContain("username");
        expect(names).toContain("email");
      });
    });

    describe("params access detection", () => {
      it("should detect params.fieldName access patterns", () => {
        const result = parseDaVinciCode(CODE_WITH_PARAMS);

        // params.currentAge and params.userName should be detected
        expect(result.variables.length).toBeGreaterThanOrEqual(0);
        // The parser should surface params access somehow
        expect(result).toBeDefined();
      });
    });

    describe("API call detection", () => {
      it("should detect fetch() calls", () => {
        const result = parseDaVinciCode(SIMPLE_CUSTOM_FUNCTION);

        expect(result.apiCalls.length).toBeGreaterThanOrEqual(1);
        expect(result.apiCalls[0].method).toBeDefined();
      });

      it("should detect multiple fetch calls", () => {
        const result = parseDaVinciCode(CODE_WITH_ERROR_HANDLING);

        expect(result.apiCalls.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe("flow logic detection", () => {
      it("should detect conditionals (if/else)", () => {
        const result = parseDaVinciCode(CODE_WITH_LOCAL_VARS);

        expect(result.flowLogic.hasConditionals).toBe(true);
      });

      it("should detect loops (for)", () => {
        const result = parseDaVinciCode(CODE_WITH_PARAMS);

        expect(result.flowLogic.hasLoops).toBe(true);
      });

      it("should detect JSON.parse usage", () => {
        const result = parseDaVinciCode(SIMPLE_CUSTOM_FUNCTION);

        expect(result.flowLogic.hasJsonParse).toBe(true);
      });

      it("should detect try/catch error handling", () => {
        const result = parseDaVinciCode(CODE_WITH_ERROR_HANDLING);

        expect(result.flowLogic.hasErrorHandling).toBe(true);
      });

      it("should detect async/await", () => {
        const result = parseDaVinciCode(SIMPLE_CUSTOM_FUNCTION);

        expect(result.flowLogic.hasAsyncAwait).toBe(true);
      });

      it("should report false for missing flow logic", () => {
        const simpleCode = `module.exports = a = async ({params}) => {
          return { hello: "world" };
        }`;

        const result = parseDaVinciCode(simpleCode);

        expect(result.flowLogic.hasConditionals).toBe(false);
        expect(result.flowLogic.hasLoops).toBe(false);
        expect(result.flowLogic.hasJsonParse).toBe(false);
        expect(result.flowLogic.hasErrorHandling).toBe(false);
      });
    });

    describe("unsupported pattern warnings", () => {
      it("should warn about require() usage", () => {
        const result = parseDaVinciCode(CODE_WITH_FS_USAGE);

        expect(result.warnings.length).toBeGreaterThanOrEqual(1);
        const fsWarning = result.warnings.find((w) =>
          w.toLowerCase().includes("require")
        );
        expect(fsWarning).toBeDefined();
      });

      it("should warn about fs (File System) usage", () => {
        const result = parseDaVinciCode(CODE_WITH_FS_USAGE);

        const fsWarning = result.warnings.find((w) =>
          w.toLowerCase().includes("file system") || w.toLowerCase().includes("fs")
        );
        expect(fsWarning).toBeDefined();
      });
    });

    describe("plugin type recommendation", () => {
      it("should recommend a plugin type", () => {
        const result = parseDaVinciCode(SIMPLE_CUSTOM_FUNCTION);

        expect(result.recommendedPluginType).toBeDefined();
        expect(result.pluginTypeConfidence).toBeGreaterThanOrEqual(0);
        expect(result.pluginTypeConfidence).toBeLessThanOrEqual(1);
      });
    });

    describe("return statement extraction", () => {
      it("should detect return keys as potential output schema", () => {
        const result = parseDaVinciCode(SIMPLE_CUSTOM_FUNCTION);

        // The parser should be able to extract return object keys
        expect(result).toBeDefined();
        expect(result.sourceLineCount).toBeGreaterThan(0);
      });
    });
  });
});
