import { describe, it, expect } from "vitest";
import { parseDaVinciCode } from "../../core/davinci/davinci-parser.js";

// ── Fixtures ─────────────────────────────────────────────────────────

const SCENARIO_01_CODE_SNIPPET = `module.exports = a = async ({params}) => { if (params.age >= 65) { return { discount: 20 }; } return { discount: 0 }; }`;

const SCENARIO_02_JWT_DECODE = `module.exports = a = async ({params}) => {
  const decoded = JSON.parse(Buffer.from(params.token.split('.')[1], 'base64').toString());
  return { sub: decoded.sub };
}`;

const SCENARIO_03_HTML_TEMPLATE = `<script>const name = "{{username}}"; document.getElementById("msg").textContent = "Hi " + name;</script>`;

const SCENARIO_04_COMPANY_SCOPE = `module.exports = a = async ({params}) => {
  const secret = "{{global.company.variables.apiSecret}}";
  return { hasSecret: !!secret };
}`;

const SCENARIO_05_USER_SCOPE = `module.exports = a = async ({params}) => {
  const email = "{{global.userInfo.variables.email}}";
  return { email };
}`;

const SCENARIO_06_FLOW_SCOPE = `module.exports = a = async ({params}) => {
  const sessionId = "{{global.flow.variables.sessionId}}";
  return { sessionId };
}`;

const SCENARIO_07_FLOW_INSTANCE = `module.exports = a = async ({params}) => {
  const redirectUrl = "{{global.variables.redirectUrl}}";
  return { redirectUrl };
}`;

const SCENARIO_08_LOCAL_NODE = `module.exports = a = async ({params}) => {
  const rawBody = "{{local.httpConnector.makeRestApiCall.output.rawBody}}";
  return { rawBody };
}`;

const SCENARIO_09_GLOBAL_PARAMS_IP = `module.exports = a = async ({params}) => {
  const ip = params.ip;
  const userAgent = params.userAgent;
  return { ip, userAgent };
}`;

const SCENARIO_10_GLOBAL_PARAMS_COOKIES = `module.exports = a = async ({params}) => {
  const cookies = params.cookies;
  const sessionToken = params.sessionToken;
  return { cookies, sessionToken };
}`;

const SCENARIO_11_WHILE_LOOP = `module.exports = a = async ({params}) => {
  let retries = 0;
  while (retries < 3) {
    retries++;
  }
  return { retries };
}`;

const SCENARIO_12_SWITCH_CASE = `module.exports = a = async ({params}) => {
  let channel;
  switch (params.mfaMethod) {
    case "SMS":
      channel = "sms";
      break;
    case "EMAIL":
      channel = "email";
      break;
    default:
      channel = "push";
  }
  return { channel };
}`;

const SCENARIO_13_PROMISE_CHAIN = `module.exports = a = async ({params}) => {
  return fetch("https://api.example.com/users")
    .then(r => r.json())
    .then(data => {
      return { data };
    });
}`;

const SCENARIO_14_MULTIPLE_JSON_PARSE = `module.exports = a = async ({params}) => {
  const first = JSON.parse(params.payloadA);
  const second = JSON.parse(params.payloadB);
  return { first, second };
}`;

const SCENARIO_15_AXIOS_POST = `module.exports = a = async ({params}) => {
  const result = axios.post("https://api.example.com/data", { key: params.key });
  return { result };
}`;

// ── Tests ────────────────────────────────────────────────────────────

describe("parser-scenarios", () => {
  it("01 — code_snippet with conditionals", () => {
    const analysis = parseDaVinciCode(SCENARIO_01_CODE_SNIPPET, {
      codeLocation: "code_snippet",
    });

    expect(analysis.codeLocation).toBe("code_snippet");
    expect(analysis.flowLogic.hasConditionals).toBe(true);
  });

  it("02 — custom function with JWT decode (JSON.parse + async/await)", () => {
    const analysis = parseDaVinciCode(SCENARIO_02_JWT_DECODE);

    expect(analysis.flowLogic.hasJsonParse).toBe(true);
    expect(analysis.flowLogic.hasAsyncAwait).toBe(true);
  });

  it("03 — HTML template with Handlebars parameter", () => {
    const analysis = parseDaVinciCode(SCENARIO_03_HTML_TEMPLATE, {
      codeLocation: "html_template",
    });

    expect(analysis.codeLocation).toBe("html_template");
    const usernameVar = analysis.variables.find(
      (v) => v.fieldName === "username",
    );
    expect(usernameVar).toBeDefined();
    expect(usernameVar!.kind).toBe("parameter");
  });

  it("04 — company scope variable (global.company.variables)", () => {
    const analysis = parseDaVinciCode(SCENARIO_04_COMPANY_SCOPE);

    const companyVar = analysis.variables.find(
      (v) => v.fieldName === "apiSecret",
    );
    expect(companyVar).toBeDefined();
    expect(companyVar!.kind).toBe("global");
    expect(companyVar!.path).toContain("company");
  });

  it("05 — user scope variable (global.userInfo.variables)", () => {
    const analysis = parseDaVinciCode(SCENARIO_05_USER_SCOPE);

    const userVar = analysis.variables.find((v) => v.fieldName === "email");
    expect(userVar).toBeDefined();
    expect(userVar!.kind).toBe("global");
    expect(userVar!.path).toContain("userInfo");
  });

  it("06 — flow scope variable (global.flow.variables)", () => {
    const analysis = parseDaVinciCode(SCENARIO_06_FLOW_SCOPE);

    const flowVar = analysis.variables.find(
      (v) => v.fieldName === "sessionId",
    );
    expect(flowVar).toBeDefined();
    expect(flowVar!.kind).toBe("flow");
  });

  it("07 — flow instance variable (global.variables)", () => {
    const analysis = parseDaVinciCode(SCENARIO_07_FLOW_INSTANCE);

    const globalVar = analysis.variables.find(
      (v) => v.fieldName === "redirectUrl",
    );
    expect(globalVar).toBeDefined();
    expect(globalVar!.kind).toBe("global");
  });

  it("08 — local node output with specific nodeId and capability", () => {
    const analysis = parseDaVinciCode(SCENARIO_08_LOCAL_NODE);

    const localVar = analysis.variables.find(
      (v) => v.fieldName === "rawBody",
    );
    expect(localVar).toBeDefined();
    expect(localVar!.kind).toBe("local");
    expect(localVar!.nodeId).toBe("httpConnector");
    expect(localVar!.capability).toBe("makeRestApiCall");
  });

  it("09 — global params ip and userAgent", () => {
    const analysis = parseDaVinciCode(SCENARIO_09_GLOBAL_PARAMS_IP);

    expect(analysis).toBeDefined();
    expect(analysis.sourceLineCount).toBeGreaterThan(0);
  });

  it("10 — global params cookies and sessionToken", () => {
    const analysis = parseDaVinciCode(SCENARIO_10_GLOBAL_PARAMS_COOKIES);

    expect(analysis).toBeDefined();
  });

  it("11 — while loop detection", () => {
    const analysis = parseDaVinciCode(SCENARIO_11_WHILE_LOOP);

    expect(analysis.flowLogic.hasLoops).toBe(true);
  });

  it("12 — switch/case detection as conditionals", () => {
    const analysis = parseDaVinciCode(SCENARIO_12_SWITCH_CASE);

    expect(analysis.flowLogic.hasConditionals).toBe(true);
  });

  it("13 — promise chain with fetch detects API call", () => {
    const analysis = parseDaVinciCode(SCENARIO_13_PROMISE_CHAIN);

    expect(analysis.apiCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("14 — multiple JSON.parse calls detected", () => {
    const analysis = parseDaVinciCode(SCENARIO_14_MULTIPLE_JSON_PARSE);

    expect(analysis.flowLogic.hasJsonParse).toBe(true);
  });

  it("15 — axios.post pattern detects API call", () => {
    const analysis = parseDaVinciCode(SCENARIO_15_AXIOS_POST);

    expect(analysis.apiCalls.length).toBeGreaterThanOrEqual(1);
  });
});
