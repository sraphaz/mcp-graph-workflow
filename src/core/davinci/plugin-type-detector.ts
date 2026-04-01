import type { DaVinciAnalysis, PfPluginType } from "./davinci-types.js";

// ── Types ─────────────────────────────────────────────────────────────

export type TargetSdkMode = "pingfederate" | "pingaccess";

export type PaPluginType = "rule" | "identity-mapping" | "load-balancing" | "site-authenticator";

export interface DetectionResult {
  pluginType: PfPluginType | PaPluginType;
  confidence: number;
  warnings: string[];
  scores: Record<string, number>;
}

export interface DetectionOptions {
  override?: string;
  sourceCode?: string;
}

// ── Main Entry Point ──────────────────────────────────────────────────

export function detectPluginType(
  analysis: DaVinciAnalysis,
  mode: TargetSdkMode,
  options: DetectionOptions = {},
): DetectionResult {
  if (options.override) {
    return {
      pluginType: options.override as PfPluginType | PaPluginType,
      confidence: 1,
      warnings: [],
      scores: { [options.override]: 1 },
    };
  }

  const sourceCode = options.sourceCode ?? "";

  if (mode === "pingaccess") {
    return detectPingAccessType(analysis, sourceCode);
  }
  return detectPingFederateType(analysis, sourceCode);
}

// ── PingFederate Detection ────────────────────────────────────────────

function detectPingFederateType(analysis: DaVinciAnalysis, sourceCode: string): DetectionResult {
  const scores: Record<string, number> = {};
  const code = sourceCode || reconstructCode(analysis);

  // HTTP calls → idp-adapter
  if (analysis.apiCalls.length > 0) {
    scores["idp-adapter"] = (scores["idp-adapter"] ?? 0) + 0.4;
  }

  // JWT/token patterns → token-generator
  if (/\b(jwt|token|sign|verify|encode|decode)\b/i.test(code)) {
    scores["token-generator"] = (scores["token-generator"] ?? 0) + 0.5;
  }

  // Password/credential patterns → password-credential-validator
  if (/\b(password|credential|authenticate|login)\b/i.test(code)) {
    scores["password-credential-validator"] = (scores["password-credential-validator"] ?? 0) + 0.5;
  }

  // Storage/persistence patterns → access-grant-manager
  if (/\b(save|store|persist|getByClientId|grant)\b/i.test(code)) {
    scores["access-grant-manager"] = (scores["access-grant-manager"] ?? 0) + 0.4;
  }

  // Notification/webhook patterns → notification-publisher
  if (/\b(notify|notification|webhook|email|event)\b/i.test(code)) {
    scores["notification-publisher"] = (scores["notification-publisher"] ?? 0) + 0.5;
  }

  // Secret/vault/env patterns → secret-manager
  if (/\b(secret|vault|getenv|environment)\b/i.test(code)) {
    scores["secret-manager"] = (scores["secret-manager"] ?? 0) + 0.4;
  }

  // LDAP/DB query patterns → custom-data-store
  if (/\b(ldap|query|search|datastore|db\.)\b/i.test(code)) {
    scores["custom-data-store"] = (scores["custom-data-store"] ?? 0) + 0.4;
  }

  return buildResult(scores, "idp-adapter");
}

// ── PingAccess Detection ──────────────────────────────────────────────

function detectPingAccessType(analysis: DaVinciAnalysis, sourceCode: string): DetectionResult {
  const scores: Record<string, number> = {};
  const code = sourceCode || reconstructCode(analysis);

  // HTTP request/response manipulation → rule
  if (/\b(httpRequest|getHeader|statusCode|allowed|forbidden|request\.get)\b/i.test(code)) {
    scores["rule"] = (scores["rule"] ?? 0) + 0.5;
  }

  // Token extraction / identity mapping
  if (/\b(identity|mappedIdentity|subject|accessToken|decoded|mapping)\b/i.test(code)) {
    scores["identity-mapping"] = (scores["identity-mapping"] ?? 0) + 0.5;
  }

  // Server selection / load balancing
  if (/\b(server|backend|loadBalance|roundRobin|weight)\b/i.test(code)) {
    scores["load-balancing"] = (scores["load-balancing"] ?? 0) + 0.5;
  }

  // Site authentication
  if (/\b(siteAuth|basicAuth|formAuth|siteCredential)\b/i.test(code)) {
    scores["site-authenticator"] = (scores["site-authenticator"] ?? 0) + 0.5;
  }

  return buildResult(scores, "rule");
}

// ── Helpers ───────────────────────────────────────────────────────────

function reconstructCode(analysis: DaVinciAnalysis): string {
  // Use variables and other analysis data to reconstruct code context
  const parts: string[] = [];
  for (const v of analysis.variables) {
    parts.push(v.rawTemplate);
  }
  for (const call of analysis.apiCalls) {
    parts.push(call.url ?? "");
    parts.push(call.method);
  }
  // Also check warnings for additional context
  for (const w of analysis.warnings) {
    parts.push(w);
  }
  return parts.join(" ");
}

function buildResult(
  scores: Record<string, number>,
  fallbackType: string,
): DetectionResult {
  const warnings: string[] = [];

  // Find best match
  let bestType = fallbackType;
  let bestScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestType = type;
      bestScore = score;
    }
  }

  // Check for ambiguity (multiple types with similar scores)
  const significantTypes = Object.entries(scores).filter(([, s]) => s >= 0.3);
  if (significantTypes.length > 2) {
    warnings.push(
      `Ambiguous: ${significantTypes.length} plugin types detected with similar scores: ${significantTypes.map(([t]) => t).join(", ")}. Consider manual override.`,
    );
  }

  const confidence = bestScore > 0 ? Math.min(bestScore + 0.2, 1) : 0.3;

  return {
    pluginType: bestType as PfPluginType | PaPluginType,
    confidence,
    warnings,
    scores,
  };
}
