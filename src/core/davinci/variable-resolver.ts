import type { DaVinciVariable, ResolvedVariable } from "./davinci-types.js";

// ── Options ───────────────────────────────────────────────────────────

export interface ResolveOptions {
  jsonParseContext?: boolean;
}

// ── Core Resolution ───────────────────────────────────────────────────

export function resolveVariable(
  variable: DaVinciVariable,
  options: ResolveOptions = {},
): ResolvedVariable {
  const javaExpression = buildJavaExpression(variable, options);
  const guiFieldCode = generateGuiFieldCode(variable);
  const configureCode = generateConfigureCode(variable);

  return {
    original: variable,
    javaExpression,
    guiFieldCode: guiFieldCode || undefined,
    configureCode: configureCode || undefined,
  };
}

export function resolveVariables(variables: DaVinciVariable[]): ResolvedVariable[] {
  const seen = new Set<string>();
  const results: ResolvedVariable[] = [];

  for (const variable of variables) {
    const key = `${variable.kind}:${variable.fieldName}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(resolveVariable(variable));
  }

  return results;
}

// ── Java Expression Builder ───────────────────────────────────────────

function buildJavaExpression(
  variable: DaVinciVariable,
  options: ResolveOptions,
): string {
  if (options.jsonParseContext) {
    return `new ObjectMapper().readTree(configuration.getFieldValue("${variable.fieldName}"))`;
  }

  switch (variable.kind) {
    case "local":
      return `inMap.get("${variable.fieldName}").getValue() /* from node: ${variable.nodeId ?? "unknown"} */`;

    case "global":
    case "flow":
    case "parameter":
      return `configuration.getFieldValue("${variable.fieldName}")`;

    default:
      return `configuration.getFieldValue("${variable.fieldName}")`;
  }
}

// ── GUI Field Code Generator ──────────────────────────────────────────

export function generateGuiFieldCode(variable: DaVinciVariable): string {
  if (variable.kind === "local") {
    return "";
  }

  const fieldName = variable.fieldName;
  const lines = [
    `TextFieldDescriptor ${fieldName}Field = new TextFieldDescriptor("${fieldName}", "DaVinci variable: ${fieldName}");`,
    `guiDescriptor.addField(${fieldName}Field);`,
  ];

  return lines.join("\n");
}

// ── Configure Code Generator ──────────────────────────────────────────

export function generateConfigureCode(variable: DaVinciVariable): string {
  if (variable.kind === "local") {
    return "";
  }

  const fieldName = variable.fieldName;
  return `this.${fieldName} = configuration.getFieldValue("${fieldName}");`;
}
