import type { DaVinciAnalysis } from "./davinci-types.js";
import type { GeneratePluginResult } from "./plugin-generator.js";
import type { BuildResult } from "./davinci-types.js";

// ── Validation Result ─────────────────────────────────────────────────

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// ── Pre-Conversion Validation ─────────────────────────────────────────

/** Validate DaVinci source code before conversion, checking for unsupported patterns. */
export function validatePreConversion(code: string, analysis: DaVinciAnalysis): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Empty code
  if (!code.trim()) {
    issues.push({ severity: "error", code: "empty_code", message: "Source code is empty" });
  }

  // No module.exports pattern
  if (!code.includes("module.exports")) {
    issues.push({ severity: "warning", code: "no_module_exports", message: "No module.exports pattern detected. DaVinci custom functions use module.exports = a = async ({params}) => { ... }" });
  }

  // require() usage
  if (/\brequire\s*\(/.test(code)) {
    issues.push({ severity: "warning", code: "require_usage", message: "require() detected. DaVinci runtime only supports Buffer as built-in library. External modules will not work in the Java plugin." });
  }

  // fs usage (mockup in DaVinci)
  if (/\bfs\b/.test(code) && /readFileSync|writeFileSync|readFile|writeFile/.test(code)) {
    issues.push({ severity: "warning", code: "fs_usage", message: "File System (fs) usage detected. DaVinci fs is a non-functional mockup. These operations need manual Java implementation." });
  }

  // Very large code
  if (analysis.sourceLineCount > 500) {
    issues.push({ severity: "warning", code: "large_code", message: `Source code has ${analysis.sourceLineCount} lines. Large functions may produce incomplete translations.` });
  }

  // No variables detected
  if (analysis.variables.length === 0 && analysis.apiCalls.length === 0) {
    issues.push({ severity: "info", code: "simple_code", message: "No DaVinci variables or API calls detected. The generated plugin will have minimal functionality." });
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}

// ── Post-Generation Validation ────────────────────────────────────────

/** Validate generated Java plugin code for completeness and structural correctness. */
export function validatePostGeneration(result: GeneratePluginResult): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Check Java code was generated
  if (!result.javaCode || result.javaCode.includes("No template available")) {
    issues.push({ severity: "error", code: "no_java_code", message: "No Java code was generated. The plugin type may not have a template." });
  }

  // Check Java has package declaration
  if (result.javaCode && !result.javaCode.includes("package ")) {
    issues.push({ severity: "error", code: "no_package", message: "Generated Java code is missing package declaration." });
  }

  // Check Java has class declaration
  if (result.javaCode && !result.javaCode.includes("public class ")) {
    issues.push({ severity: "error", code: "no_class", message: "Generated Java code is missing class declaration." });
  }

  // Check imports present
  if (result.javaCode && !result.javaCode.includes("import ")) {
    issues.push({ severity: "warning", code: "no_imports", message: "Generated Java code has no imports. The class may not compile." });
  }

  // Check POM was generated
  if (!result.pomXml || !result.pomXml.includes("<project")) {
    issues.push({ severity: "error", code: "no_pom", message: "No valid POM.xml was generated." });
  }

  // Low confidence
  if (result.confidence < 0.5) {
    issues.push({ severity: "warning", code: "low_confidence", message: `Plugin type detection confidence is low (${(result.confidence * 100).toFixed(0)}%). Consider manually overriding the plugin type.` });
  }

  // Propagate warnings from generation
  for (const w of result.warnings) {
    issues.push({ severity: "warning", code: "generation_warning", message: w });
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}

// ── Build Result Validation ───────────────────────────────────────────

/** Validate a Maven build result, checking for success, JAR output, and build duration. */
export function validateBuildResult(result: BuildResult): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!result.success) {
    issues.push({ severity: "error", code: "build_failed", message: `Maven build failed: ${result.stderr.slice(0, 200)}` });
  }

  if (result.success && !result.jarPath) {
    issues.push({ severity: "warning", code: "no_jar", message: "Build succeeded but no JAR file was found in target/." });
  }

  if (result.durationMs > 60000) {
    issues.push({ severity: "info", code: "slow_build", message: `Build took ${(result.durationMs / 1000).toFixed(1)}s. Consider checking for dependency download issues.` });
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}
