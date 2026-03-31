/**
 * PlaceholderResolver — extracts {{placeholder}} values from source text.
 *
 * Given a construct's sourceText, constructId, and source language,
 * extracts meaningful parts (name, params, body, condition, etc.)
 * that can be substituted into UCR syntax patterns for the target language.
 *
 * Extractors are grouped by construct type and language family:
 * - Brace-C family: TS, Java, Go, Rust, C#, C++, PHP, Swift, Kotlin, Scala, Dart
 * - Indent family: Python, Haskell
 * - Keyword-end family: Ruby, Lua, Elixir
 */

// ── Language Families ─────────────────────────────

const INDENT_LANGUAGES = new Set(["python", "haskell"]);
const KEYWORD_END_LANGUAGES = new Set(["ruby", "lua", "elixir"]);

// ── Public API ────────────────────────────────────

/**
 * Extract placeholder values from sourceText based on construct type and language.
 * Returns a Record<string, string> with keys matching UCR pattern placeholders.
 */
export function resolvePlaceholders(
  sourceText: string,
  constructId: string,
  sourceLanguageId: string,
): Record<string, string> {
  if (!sourceText || sourceText.trim().length === 0) {
    return {};
  }

  // Function constructs
  if (isFunctionConstruct(constructId)) {
    if (INDENT_LANGUAGES.has(sourceLanguageId)) {
      return resolveIndentFunction(sourceText);
    }
    if (KEYWORD_END_LANGUAGES.has(sourceLanguageId)) {
      return resolveKeywordEndFunction(sourceText);
    }
    // Default: brace family
    if (constructId === "uc_arrow_fn") {
      return resolveArrowFunction(sourceText);
    }
    return resolveBraceFunction(sourceText);
  }

  // Class constructs
  if (isClassConstruct(constructId)) {
    if (INDENT_LANGUAGES.has(sourceLanguageId)) {
      return resolveIndentClass(sourceText);
    }
    return resolveBraceClass(sourceText);
  }

  // Control flow
  if (constructId === "uc_if_else") {
    if (INDENT_LANGUAGES.has(sourceLanguageId)) {
      return resolveIndentIfElse(sourceText);
    }
    return resolveBraceIfElse(sourceText);
  }

  // Loops
  if (isLoopConstruct(constructId)) {
    if (INDENT_LANGUAGES.has(sourceLanguageId)) {
      return resolveIndentLoop(sourceText);
    }
    return resolveBraceLoop(sourceText);
  }

  // Try/catch
  if (constructId === "uc_try_catch" || constructId === "uc_try_finally") {
    return resolveBraceTryCatch(sourceText);
  }

  // Imports
  if (isImportConstruct(constructId)) {
    return resolveImport(sourceText);
  }

  // Return/throw
  if (constructId === "uc_return") {
    return resolveReturn(sourceText);
  }
  if (constructId === "uc_throw") {
    return resolveThrow(sourceText);
  }

  // Variable declarations
  if (isVariableConstruct(constructId)) {
    return resolveVariable(sourceText);
  }

  // Switch
  if (constructId === "uc_switch") {
    return resolveBraceSwitch(sourceText);
  }

  // Unknown construct — return empty
  return {};
}

// ── Construct Type Checks ─────────────────────────

function isFunctionConstruct(id: string): boolean {
  return ["uc_fn_def", "uc_method_def", "uc_arrow_fn", "uc_async_fn", "uc_constructor", "uc_generator"].includes(id);
}

function isClassConstruct(id: string): boolean {
  return ["uc_class_def", "uc_interface", "uc_abstract_class"].includes(id);
}

function isLoopConstruct(id: string): boolean {
  return ["uc_for_loop", "uc_for_each", "uc_while", "uc_do_while"].includes(id);
}

function isImportConstruct(id: string): boolean {
  return ["uc_import_named", "uc_import_default", "uc_import_namespace"].includes(id);
}

function isVariableConstruct(id: string): boolean {
  return ["uc_const_decl", "uc_let_decl", "uc_var_decl"].includes(id);
}

// ── Brace-Family Function Resolver ────────────────

function resolveBraceFunction(source: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Match: [async] [public/private/static/...] [returnType] functionName(params) [: returnType] { body }
  // Also: function name(params): returnType { body }
  // Also: func name(params) returnType { body }  (Go)

  // Extract params from first (...)
  const paramsMatch = source.match(/\(([^)]*)\)/);
  if (paramsMatch) {
    result.params = paramsMatch[1].trim();
  } else {
    result.params = "";
  }

  // Extract name — word before the opening paren
  const beforeParen = source.substring(0, source.indexOf("("));
  const nameMatch = beforeParen.match(/(\w+)\s*$/);
  if (nameMatch) {
    result.name = nameMatch[1];
  }

  // Extract returnType — between closing paren and opening brace
  const closeParen = source.indexOf(")");
  const openBrace = source.indexOf("{");
  if (closeParen >= 0 && openBrace > closeParen) {
    const between = source.substring(closeParen + 1, openBrace).trim();
    // TypeScript style: ): returnType {
    const tsReturn = between.match(/^:\s*(.+)/);
    if (tsReturn) {
      result.returnType = tsReturn[1].trim();
    }
    // Go style: ) returnType {
    else if (between.length > 0 && !between.startsWith("{")) {
      result.returnType = between;
    }
    // Java style: returnType is before the name — extract from modifiers
    if (!result.returnType) {
      const javaMatch = beforeParen.match(/(?:public|private|protected|static|final|abstract)?\s*(\w+)\s+\w+\s*$/);
      if (javaMatch && javaMatch[1] !== "function" && javaMatch[1] !== "func" && javaMatch[1] !== "async") {
        result.returnType = javaMatch[1];
      }
    }
  }

  // Extract body — content between first { and last }
  result.body = extractBraceBody(source);

  return result;
}

function resolveArrowFunction(source: string): Record<string, string> {
  const result: Record<string, string> = {};

  // const name = (params): returnType => { body }
  // const name = (params) => expression
  const assignMatch = source.match(/(?:const|let|var)\s+(\w+)\s*=/);
  if (assignMatch) {
    result.name = assignMatch[1];
  }

  const paramsMatch = source.match(/\(([^)]*)\)/);
  if (paramsMatch) {
    result.params = paramsMatch[1].trim();
  } else {
    result.params = "";
  }

  // Return type between ) and =>
  const arrowIdx = source.indexOf("=>");
  const closeParen = source.indexOf(")");
  if (closeParen >= 0 && arrowIdx > closeParen) {
    const between = source.substring(closeParen + 1, arrowIdx).trim();
    const tsReturn = between.match(/^:\s*(.+)/);
    if (tsReturn) {
      result.returnType = tsReturn[1].trim();
    }
  }

  // Body
  if (source.includes("{")) {
    result.body = extractBraceBody(source);
  } else if (arrowIdx >= 0) {
    result.body = source.substring(arrowIdx + 2).trim().replace(/;$/, "");
  }

  return result;
}

// ── Indent-Family Function Resolver ───────────────

function resolveIndentFunction(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = source.split("\n");
  const firstLine = lines[0];

  // def name(params) -> returnType:
  // eslint-disable-next-line security/detect-unsafe-regex
  const defMatch = firstLine.match(/def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\S+))?\s*:/);
  if (defMatch) {
    result.name = defMatch[1];
    result.params = defMatch[2].trim();
    if (defMatch[3]) {
      result.returnType = defMatch[3];
    }
  }

  // Body: everything after first line, dedented
  if (lines.length > 1) {
    const bodyLines = lines.slice(1);
    const minIndent = getMinIndent(bodyLines);
    result.body = bodyLines
      .map((l) => l.substring(minIndent))
      .join("\n")
      .trim();
  }

  return result;
}

// ── Keyword-End Function Resolver ─────────────────

function resolveKeywordEndFunction(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = source.split("\n");
  const firstLine = lines[0];

  // def name(params) or function name(params)
  // eslint-disable-next-line security/detect-unsafe-regex
  const defMatch = firstLine.match(/(?:def|function)\s+(\w+)\s*(?:\(([^)]*)\))?/);
  if (defMatch) {
    result.name = defMatch[1];
    result.params = (defMatch[2] ?? "").trim();
  }

  // Body: everything between first line and 'end', dedented
  if (lines.length > 2) {
    const bodyLines = lines.slice(1, -1); // Exclude first and last (end)
    const minIndent = getMinIndent(bodyLines);
    result.body = bodyLines
      .map((l) => l.substring(minIndent))
      .join("\n")
      .trim();
  }

  return result;
}

// ── Class Resolvers ───────────────────────────────

function resolveBraceClass(source: string): Record<string, string> {
  const result: Record<string, string> = {};

  // eslint-disable-next-line security/detect-unsafe-regex
  const classMatch = source.match(/class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+(\w+))?/);
  if (classMatch) {
    result.name = classMatch[1];
    if (classMatch[2]) result.parent = classMatch[2];
  }

  // Interface
  // eslint-disable-next-line security/detect-unsafe-regex
  const ifaceMatch = source.match(/interface\s+(\w+)(?:\s+extends\s+(\w+))?/);
  if (ifaceMatch && !result.name) {
    result.name = ifaceMatch[1];
    if (ifaceMatch[2]) result.parent = ifaceMatch[2];
  }

  result.body = extractBraceBody(source);
  if (result.body) result.members = result.body;

  return result;
}

function resolveIndentClass(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = source.split("\n");
  const firstLine = lines[0];

  // eslint-disable-next-line security/detect-unsafe-regex
  const classMatch = firstLine.match(/class\s+(\w+)(?:\s*\(([^)]*)\))?\s*:/);
  if (classMatch) {
    result.name = classMatch[1];
    if (classMatch[2]) result.parent = classMatch[2];
  }

  if (lines.length > 1) {
    const bodyLines = lines.slice(1);
    const minIndent = getMinIndent(bodyLines);
    result.body = bodyLines
      .map((l) => l.substring(minIndent))
      .join("\n")
      .trim();
    result.members = result.body;
  }

  return result;
}

// ── If/Else Resolvers ─────────────────────────────

function resolveBraceIfElse(source: string): Record<string, string> {
  const result: Record<string, string> = {};

  const condMatch = source.match(/if\s*\(([^)]+)\)/);
  if (condMatch) {
    result.condition = condMatch[1].trim();
  }

  result.body = extractBraceBody(source);

  // Try to extract else body
  const elseIdx = source.indexOf("else");
  if (elseIdx >= 0) {
    const afterElse = source.substring(elseIdx + 4);
    const elseBody = extractBraceBody(afterElse);
    if (elseBody) result.elseBody = elseBody;
  }

  return result;
}

function resolveIndentIfElse(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = source.split("\n");

  const condMatch = lines[0].match(/if\s+(.+)\s*:/);
  if (condMatch) {
    result.condition = condMatch[1].trim();
  }

  // Body: indented lines after if
  if (lines.length > 1) {
    const bodyLines: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith("else")) break;
      bodyLines.push(lines[i]);
    }
    const minIndent = getMinIndent(bodyLines);
    result.body = bodyLines.map((l) => l.substring(minIndent)).join("\n").trim();
  }

  return result;
}

// ── Loop Resolvers ────────────────────────────────

function resolveBraceLoop(source: string): Record<string, string> {
  const result: Record<string, string> = {};

  // for (const item of items) or for (let i = 0; ...)
  const forOfMatch = source.match(/for\s*\(\s*(?:const|let|var)?\s*(\w+)\s+(?:of|in)\s+(.+?)\)/);
  if (forOfMatch) {
    result.variable = forOfMatch[1];
    result.iterable = forOfMatch[2].trim();
    result.item = forOfMatch[1];
  }

  // while (condition)
  const whileMatch = source.match(/while\s*\(([^)]+)\)/);
  if (whileMatch) {
    result.condition = whileMatch[1].trim();
  }

  result.body = extractBraceBody(source);

  return result;
}

function resolveIndentLoop(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = source.split("\n");

  const forMatch = lines[0].match(/for\s+(\w+)\s+in\s+(.+)\s*:/);
  if (forMatch) {
    result.variable = forMatch[1];
    result.iterable = forMatch[2].trim();
    result.item = forMatch[1];
  }

  const whileMatch = lines[0].match(/while\s+(.+)\s*:/);
  if (whileMatch) {
    result.condition = whileMatch[1].trim();
  }

  if (lines.length > 1) {
    const bodyLines = lines.slice(1);
    const minIndent = getMinIndent(bodyLines);
    result.body = bodyLines.map((l) => l.substring(minIndent)).join("\n").trim();
  }

  return result;
}

// ── Try/Catch Resolver ────────────────────────────

function resolveBraceTryCatch(source: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Try body
  const tryIdx = source.indexOf("try");
  const catchIdx = source.indexOf("catch");
  if (tryIdx >= 0 && catchIdx > tryIdx) {
    const tryBlock = source.substring(tryIdx + 3, catchIdx);
    result.body = extractBraceBody(tryBlock) || tryBlock.trim();
  }

  // Catch error variable
  const catchMatch = source.match(/catch\s*\(\s*(\w+)\s*\)/);
  if (catchMatch) {
    result.error = catchMatch[1];
  }

  return result;
}

// ── Switch Resolver ───────────────────────────────

function resolveBraceSwitch(source: string): Record<string, string> {
  const result: Record<string, string> = {};

  const switchMatch = source.match(/switch\s*\(([^)]+)\)/);
  if (switchMatch) {
    result.expression = switchMatch[1].trim();
  }

  result.body = extractBraceBody(source);

  return result;
}

// ── Import Resolver ───────────────────────────────

function resolveImport(source: string): Record<string, string> {
  const result: Record<string, string> = {};

  // import { names } from 'module'
  const namedMatch = source.match(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/);
  if (namedMatch) {
    result.names = namedMatch[1].trim();
    result.module = namedMatch[2];
    return result;
  }

  // import name from 'module'
  const defaultMatch = source.match(/import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/);
  if (defaultMatch) {
    result.name = defaultMatch[1];
    result.module = defaultMatch[2];
    return result;
  }

  // import * as name from 'module'
  const nsMatch = source.match(/import\s+\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/);
  if (nsMatch) {
    result.name = nsMatch[1];
    result.module = nsMatch[2];
    return result;
  }

  // Python: from module import names
  const pyMatch = source.match(/from\s+(\S+)\s+import\s+(.+)/);
  if (pyMatch) {
    result.module = pyMatch[1];
    result.names = pyMatch[2].trim();
    return result;
  }

  // Go/Java: import "module" or import module.path
  const simpleMatch = source.match(/import\s+['"]?([^'";\s]+)['"]?/);
  if (simpleMatch) {
    result.module = simpleMatch[1];
  }

  return result;
}

// ── Return/Throw Resolvers ────────────────────────

function resolveReturn(source: string): Record<string, string> {
  const trimmed = source.trim().replace(/;$/, "").trim();
  const match = trimmed.match(/^return\s+([\s\S]+)$/);
  if (match) {
    const val = match[1].trim();
    return { expression: val, value: val };
  }
  return { expression: "", value: "" };
}

function resolveThrow(source: string): Record<string, string> {
  const trimmed = source.trim().replace(/;$/, "").trim();
  const match = trimmed.match(/^throw\s+([\s\S]+)$/);
  if (match) {
    return { expression: match[1].trim(), message: match[1].trim() };
  }
  return { expression: "", message: "" };
}

// ── Variable Resolver ─────────────────────────────

function resolveVariable(source: string): Record<string, string> {
  const result: Record<string, string> = {};

  // const/let/var name [: type] = value
  // eslint-disable-next-line security/detect-unsafe-regex
  const match = source.match(/(?:const|let|var)\s+(\w+)(?:\s*:\s*(\S+))?\s*=\s*(.+?)[\s;]*$/);
  if (match) {
    result.name = match[1];
    if (match[2]) result.type = match[2];
    result.value = match[3].trim();
  }

  return result;
}

// ── Helpers ───────────────────────────────────────

/** Extract content between first { and last }, trimmed and dedented. */
function extractBraceBody(source: string): string {
  const openIdx = source.indexOf("{");
  const closeIdx = source.lastIndexOf("}");
  if (openIdx < 0 || closeIdx <= openIdx) return "";

  const body = source.substring(openIdx + 1, closeIdx);
  const lines = body.split("\n");
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return "";

  const minIndent = getMinIndent(nonEmpty);
  return nonEmpty
    .map((l) => l.substring(minIndent))
    .join("\n")
    .trim();
}

/** Get minimum indentation level of non-empty lines. */
function getMinIndent(lines: string[]): number {
  let min = Infinity;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    let indent = 0;
    for (const ch of line) {
      if (ch === " ") indent++;
      else if (ch === "\t") indent += 4;
      else break;
    }
    if (indent < min) min = indent;
  }
  return min === Infinity ? 0 : min;
}
