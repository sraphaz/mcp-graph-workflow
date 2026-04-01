import type {
  DaVinciAnalysis,
  DaVinciVariable,
  DaVinciCodeLocation,
  DaVinciApiCall,
  DaVinciFlowLogic,
  PfPluginType,
} from "./davinci-types.js";

// ── Parser Options ────────────────────────────────────────────────────

export interface ParseOptions {
  codeLocation?: DaVinciCodeLocation;
}

// ── Main Entry Point ──────────────────────────────────────────────────

export function parseDaVinciCode(
  code: string,
  options: ParseOptions = {},
): DaVinciAnalysis {
  const lines = code.split("\n");
  const codeLocation = options.codeLocation ?? detectCodeLocation(code);
  const variables = extractVariables(code, codeLocation);
  const apiCalls = detectApiCalls(code, lines);
  const flowLogic = detectFlowLogic(code);
  const warnings = detectUnsupportedPatterns(code);
  const { pluginType, confidence } = recommendPluginType(apiCalls, flowLogic, code);

  return {
    variables,
    codeLocation,
    apiCalls,
    flowLogic,
    recommendedPluginType: pluginType,
    pluginTypeConfidence: confidence,
    warnings,
    sourceLineCount: lines.filter((l) => l.trim().length > 0).length,
  };
}

// ── Code Location Detection ───────────────────────────────────────────

function detectCodeLocation(code: string): DaVinciCodeLocation {
  if (code.includes("<script") || code.includes("</script>")) {
    return "html_template";
  }
  if (code.includes("module.exports")) {
    return "custom_function";
  }
  return "code_snippet";
}

// ── Variable Extraction ───────────────────────────────────────────────

const TEMPLATE_VAR_REGEX = /\{\{([^}]+)\}\}/g;

function extractVariables(
  code: string,
  codeLocation: DaVinciCodeLocation,
): DaVinciVariable[] {
  const variables: DaVinciVariable[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  // eslint-disable-next-line security/detect-non-literal-regexp
  const regex = new RegExp(TEMPLATE_VAR_REGEX.source, "g");

  while ((match = regex.exec(code)) !== null) {
    const rawContent = match[1].trim();
    const rawTemplate = `{{${rawContent}}}`;
    const path = rawContent.split(".");

    if (seen.has(rawTemplate)) {
      continue;
    }
    seen.add(rawTemplate);

    const variable = classifyVariable(rawContent, rawTemplate, path, codeLocation);
    if (variable) {
      variables.push(variable);
    }
  }

  return variables;
}

function classifyVariable(
  _rawContent: string,
  rawTemplate: string,
  path: string[],
  codeLocation: DaVinciCodeLocation,
): DaVinciVariable | null {
  // {{local.nodeId.capability.output.field}}
  if (path[0] === "local" && path.length >= 5) {
    return {
      kind: "local",
      rawTemplate,
      path,
      fieldName: path[path.length - 1],
      nodeId: path[1],
      capability: path[2],
    };
  }

  // {{global.flow.variables.x}}
  if (path[0] === "global" && path[1] === "flow" && path[2] === "variables") {
    return {
      kind: "flow",
      rawTemplate,
      path,
      fieldName: path[path.length - 1],
    };
  }

  // {{global.company.variables.x}}
  if (path[0] === "global" && path[1] === "company" && path[2] === "variables") {
    return {
      kind: "global",
      rawTemplate,
      path,
      fieldName: path[path.length - 1],
    };
  }

  // {{global.variables.x}} or {{global.userInfo.variables.x}}
  if (path[0] === "global" && path.includes("variables")) {
    return {
      kind: "global",
      rawTemplate,
      path,
      fieldName: path[path.length - 1],
    };
  }

  // {{parameterName}} — simple parameter (typically in html_template)
  if (path.length === 1 && codeLocation === "html_template") {
    return {
      kind: "parameter",
      rawTemplate,
      path,
      fieldName: path[0],
    };
  }

  // Fallback: treat as parameter
  if (path.length === 1) {
    return {
      kind: "parameter",
      rawTemplate,
      path,
      fieldName: path[0],
    };
  }

  return null;
}

// ── API Call Detection ────────────────────────────────────────────────

function detectApiCalls(code: string, lines: string[]): DaVinciApiCall[] {
  const calls: DaVinciApiCall[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // fetch()
    const fetchMatch = line.match(/\bfetch\s*\(/);
    if (fetchMatch) {
      const urlMatch = line.match(/fetch\s*\(\s*["'`]([^"'`]*)["'`]/);
      const methodMatch = code.match(/method\s*:\s*["'](\w+)["']/);
      calls.push({
        method: methodMatch ? methodMatch[1] : "GET",
        url: urlMatch ? urlMatch[1] : undefined,
        line: i + 1,
      });
    }

    // axios
    const axiosMatch = line.match(/\baxios\s*\.\s*(get|post|put|delete|patch)\s*\(/i);
    if (axiosMatch) {
      const urlMatch = line.match(/axios\.\w+\s*\(\s*["'`]([^"'`]*)["'`]/);
      calls.push({
        method: axiosMatch[1].toUpperCase(),
        url: urlMatch ? urlMatch[1] : undefined,
        line: i + 1,
      });
    }

    // XMLHttpRequest
    if (line.includes("XMLHttpRequest")) {
      calls.push({
        method: "GET",
        line: i + 1,
      });
    }

    // http.request
    const httpMatch = line.match(/\bhttp[s]?\s*\.\s*request\s*\(/);
    if (httpMatch) {
      calls.push({
        method: "GET",
        line: i + 1,
      });
    }
  }

  return calls;
}

// ── Flow Logic Detection ──────────────────────────────────────────────

function detectFlowLogic(code: string): DaVinciFlowLogic {
  return {
    hasConditionals: /\b(if|else|switch|case)\s*[\s(]/.test(code),
    hasLoops: /\b(for|while|do)\s*[\s(]/.test(code),
    hasJsonParse: /JSON\.parse\s*\(/.test(code),
    hasErrorHandling: /\b(try|catch)\s*[\s{(]/.test(code),
    hasAsyncAwait: /\b(async|await)\b/.test(code),
  };
}

// ── Unsupported Pattern Warnings ──────────────────────────────────────

function detectUnsupportedPatterns(code: string): string[] {
  const warnings: string[] = [];

  if (/\brequire\s*\(/.test(code)) {
    warnings.push(
      "require() detected — DaVinci does not support external Node.js modules. Only Buffer is available as a built-in library.",
    );
  }

  if (/\bfs\b/.test(code) && (/readFileSync|writeFileSync|readFile|writeFile/.test(code) || /require\s*\(\s*["']fs["']\s*\)/.test(code))) {
    warnings.push(
      "File System (fs) usage detected — DaVinci's fs library is a non-functional mockup. File operations will not work.",
    );
  }

  return warnings;
}

// ── Plugin Type Recommendation ────────────────────────────────────────

function recommendPluginType(
  apiCalls: DaVinciApiCall[],
  _flowLogic: DaVinciFlowLogic,
  code: string,
): { pluginType: PfPluginType; confidence: number } {
  const scores: Partial<Record<PfPluginType, number>> = {};

  // HTTP calls suggest idp-adapter
  if (apiCalls.length > 0) {
    scores["idp-adapter"] = (scores["idp-adapter"] ?? 0) + 0.4;
  }

  // JWT/token patterns
  if (/\b(jwt|token|sign|verify|encode|decode)\b/i.test(code)) {
    scores["token-generator"] = (scores["token-generator"] ?? 0) + 0.5;
  }

  // Password/credential patterns
  if (/\b(password|credential|authenticate|login)\b/i.test(code)) {
    scores["password-credential-validator"] = (scores["password-credential-validator"] ?? 0) + 0.5;
  }

  // Storage patterns
  if (/\b(save|store|persist|database|db)\b/i.test(code)) {
    scores["access-grant-manager"] = (scores["access-grant-manager"] ?? 0) + 0.3;
  }

  // Notification patterns
  if (/\b(notify|notification|webhook|email|send)\b/i.test(code)) {
    scores["notification-publisher"] = (scores["notification-publisher"] ?? 0) + 0.4;
  }

  // Secret/vault patterns
  if (/\b(secret|vault|getenv|environment)\b/i.test(code)) {
    scores["secret-manager"] = (scores["secret-manager"] ?? 0) + 0.4;
  }

  // Find the best match
  let bestType: PfPluginType = "idp-adapter";
  let bestScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestType = type as PfPluginType;
      bestScore = score;
    }
  }

  // Default confidence
  const confidence = bestScore > 0 ? Math.min(bestScore + 0.3, 1) : 0.3;

  return { pluginType: bestType, confidence };
}
