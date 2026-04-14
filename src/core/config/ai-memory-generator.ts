/**
 * Generates AI instruction sections for CLAUDE.md and .github/copilot-instructions.md.
 * Both outputs are idempotent (use markers to detect existing sections).
 */

import {
  TOOL_TABLE_FULL,
  DEPRECATED_TOOLS_SECTION,
  ANALYZE_MODES_SECTION,
  KNOWLEDGE_PIPELINE_SECTION,
  SKILLS_SECTION,
  PHASE_GATES_SECTION,
  DOD_SECTION,
  DOR_SECTION,
  TOOL_PREREQUISITES_SECTION,
  WORKFLOWS_SECTION,
  FLOW_PRINCIPLES_SECTION,
  QUALITY_METRICS_SECTION,
  TDD_ENFORCEMENT_SECTION,
  AGENT_ANTIPATTERNS_SECTION,
  PIPELINE_TOOLS_SECTION,
  TEAM_TASK_SECTION,
  DREAM_MODE_SECTION,
  AGENT_ACTIVITY_SECTION,
  ADVANCED_TOOLS_SECTION,
  OPERATIONAL_TOOLS_SECTION,
  CLI_COMMANDS as CLI_COMMANDS_REF,
  HARNESS_SECTION,
} from "./reference-content.js";

export const MARKER_START = "<!-- mcp-graph:start -->";
export const MARKER_END = "<!-- mcp-graph:end -->";

const MANDATORY_EXECUTION_RULE = `### ⚠️ Regra de Execução OBRIGATÓRIA

**O mcp-graph é a fonte de verdade ABSOLUTA. Nenhuma implementação acontece fora do grafo.**

1. **Node deve existir** — antes de escrever QUALQUER código, o node correspondente DEVE existir no grafo
2. **Fluxo obrigatório** — \`start_task → [implementar com TDD] → finish_task\` (pipeline v8.0) ou \`next → context(compact) → context(rag) → [TDD] → analyze(implement_done) → update_status\` (granular) — SEM EXCEÇÕES
3. **Epic = estrutura primeiro** — criar Epic + tasks filhas + edges ANTES de implementar
4. **Status tracking** — \`update_status → in_progress\` ANTES de codar, \`→ done\` APÓS completar
5. **Validação** — usar \`validate\` (action: \`ac\`) após cada task para checar critérios de aceitação
6. **Zero trabalho não-rastreado** — se não tem node no grafo, CRIAR PRIMEIRO

> **Sem node no grafo = sem código escrito.**`;

const LIFECYCLE_SUMMARY = `### Lifecycle (9 fases)

1. **ANALYZE** \u2014 Criar PRD, definir requisitos (\`import_prd\`, \`add_node\`)
2. **DESIGN** \u2014 Arquitetura, decis\u00F5es t\u00E9cnicas (\`add_node\`, \`edge\`, \`analyze\`)
3. **PLAN** \u2014 Sprint planning, decomposi\u00E7\u00E3o (\`plan_sprint\`, \`analyze\`, \`sync_stack_docs\`)
4. **IMPLEMENT** \u2014 TDD Red\u2192Green\u2192Refactor (\`next\`, \`context\`, \`update_status\`, \`analyze\` \u2014 modes: implement_done, tdd_check, progress)
5. **VALIDATE** \u2014 Testes E2E, crit\u00E9rios de aceita\u00E7\u00E3o (\`validate\`, \`metrics\`)
6. **REVIEW** \u2014 Code review, blast radius (\`export\`, \`metrics\`)
7. **HANDOFF** \u2014 PR, documenta\u00E7\u00E3o, entrega (\`export\`, \`snapshot\`)
8. **DEPLOY** \u2014 CI pipeline, release, post-release validation (\`export\`, \`snapshot\`, \`analyze\`)
9. **LISTENING** \u2014 Feedback, novo ciclo (\`add_node\`, \`import_prd\`)`;

const XP_PRINCIPLES = `### Princ\u00EDpios XP Anti-Vibe-Coding

- **TDD obrigat\u00F3rio** \u2014 Teste antes do c\u00F3digo. Sem teste = sem implementa\u00E7\u00E3o.
- **Anti-one-shot** \u2014 Nunca gere sistemas inteiros em um prompt. Decomponha em tasks at\u00F4micas.
- **Decomposi\u00E7\u00E3o at\u00F4mica** \u2014 Cada task deve ser complet\u00E1vel em \u22642h.
- **Code detachment** \u2014 Se a IA errou, explique o erro via prompt. Nunca edite manualmente.
- **CLAUDE.md como spec evolutiva** \u2014 Documente padr\u00F5es e decis\u00F5es aqui.`;

const SPECKIT_SECTION = `### Spec-Driven Development (spec-kit)

6 ferramentas adicionais para desenvolvimento guiado por especifica\u00E7\u00F5es:

| Tool | A\u00E7\u00E3o | Descri\u00E7\u00E3o |
|------|------|-----------|
| \`constitution\` | create, update, list, check | Princ\u00EDpios governantes do projeto \u2014 indexados no RAG, validados em quality gates. \`check\` valida nodes contra princ\u00EDpios |
| \`plugin\` | install, remove, enable, disable, list, info | Extens\u00F5es din\u00E2micas (SQLite). Plugins alteram behavior de tools sem modificar c\u00F3digo |
| \`preset\` | list, apply, show, create | Presets de workflow que alteram gates, WIP limits, e prerequisites |
| \`spec\` | generate, validate, list_templates | Templates de spec por fase (ANALYZE, DESIGN, PLAN, IMPLEMENT) |
| \`spec_sync\` | sync, status, history, link | Specs como documentos vivos \u2014 versionamento + sync bidirecional. Links: derived_from, implements, validates |
| \`agent_format\` | generate, list_formats, list_agents | Gera instru\u00E7\u00F5es para 6+ AI agents (markdown, TOML, skill.md, JSON) |

#### Presets dispon\u00EDveis
| Preset | Quando usar | O que muda |
|--------|-------------|------------|
| \`default\` | Projetos normais | Gates advisory, WIP=1, prerequisites advisory |
| \`strict-tdd\` | Projetos cr\u00EDticos | Gates strict, TDD obrigat\u00F3rio, prerequisites strict, harness >= 70 |
| \`agile-light\` | Prototipagem r\u00E1pida | Gates off, WIP=3, sem prerequisites |
| \`enterprise\` | Compliance/audit | Gates strict, security_scan obrigat\u00F3rio, doc_completeness required |

**Fluxo recomendado:**
1. \`constitution create\` \u2014 definir princ\u00EDpios do projeto
2. \`preset apply\` \u2014 escolher workflow (strict-tdd, agile-light, enterprise)
3. \`spec generate\` \u2014 gerar spec a partir de template
4. \`spec validate\` \u2014 validar spec contra template
5. \`spec_sync link\` \u2014 conectar spec com nodes do grafo`;

const MEMORY_VERIFICATION_RULE = `### Memory \u2260 Estado Atual

Memory files s\u00E3o **snapshots point-in-time**, n\u00E3o estado live. Contagens de progresso ("X/Y done", "% complete") ficam stale rapidamente.

**Antes de planejar baseado em memories:**
1. Grep pelo arquivo/fun\u00E7\u00E3o \u2014 se existe com implementa\u00E7\u00E3o real, o memory \u00E9 stale
2. **C\u00F3digo vence memory** \u2014 se memory diz "X n\u00E3o existe" mas c\u00F3digo mostra que sim, confiar no c\u00F3digo
3. Contagens num\u00E9ricas > 48h = possivelmente stale \u2014 verificar antes de usar

> **Nunca confiar em contagens de progresso de memories. Sempre verificar no c\u00F3digo antes de planejar.**`;

const LEAN_DISCOVERY_HINT = `> **Referências detalhadas on-demand:** Use \`help\` tool para consultar: \`tools\`, \`analyze_modes\`, \`skills\`, \`cli\`, \`knowledge\`, \`workflow\`, \`gates\`, \`dod\`, \`dor\`, \`prerequisites\`, \`workflows\`, \`flow\`, \`quality_metrics\`, \`tdd\`, \`pipeline\`, \`antipatterns\`, \`harness\`, \`dream\`, \`siebel\`, \`davinci\`, \`translate\`, \`journey\`, \`teamtask\`, \`snapshot\`, \`graph_health\`.`;

function buildSectionBody(projectName: string, mode: "lean" | "full" = "full"): string {
  const header = `## mcp-graph — ${projectName}

Este projeto usa **mcp-graph** para gestão de execução via grafo persistente (SQLite).
Dados armazenados em \`workflow-graph/graph.db\` (local, gitignored).

${MANDATORY_EXECUTION_RULE}`;

  const workflow = `### Fluxo de trabalho OBRIGATÓRIO

**Pipeline v8.0 (recomendado — 2 calls):**
\`\`\`
start_task → [implementar com TDD] → finish_task
\`\`\`

**Granular (6 calls — disponível para controle fino):**
\`\`\`
next → context(compact) → context(rag) → [implementar com TDD] → analyze(implement_done) → update_status
\`\`\``;

  if (mode === "lean") {
    return `${header}

${workflow}

${LIFECYCLE_SUMMARY}

${PHASE_GATES_SECTION}

${DOD_SECTION}

${DOR_SECTION}

${FLOW_PRINCIPLES_SECTION}

${XP_PRINCIPLES}

${SPECKIT_SECTION}

${HARNESS_SECTION}

${MEMORY_VERIFICATION_RULE}

${LEAN_DISCOVERY_HINT}`;
  }

  // Full mode — backward compatible output
  return `${header}

${TOOL_TABLE_FULL}

${DEPRECATED_TOOLS_SECTION}

${ANALYZE_MODES_SECTION}

${workflow}

${LIFECYCLE_SUMMARY}

${PHASE_GATES_SECTION}

${DOD_SECTION}

${DOR_SECTION}

${TOOL_PREREQUISITES_SECTION}

${WORKFLOWS_SECTION}

${FLOW_PRINCIPLES_SECTION}

${QUALITY_METRICS_SECTION}

${TDD_ENFORCEMENT_SECTION}

${KNOWLEDGE_PIPELINE_SECTION}

${SKILLS_SECTION}

${XP_PRINCIPLES}

${SPECKIT_SECTION}

${HARNESS_SECTION}

${MEMORY_VERIFICATION_RULE}

${AGENT_ANTIPATTERNS_SECTION}

${PIPELINE_TOOLS_SECTION}

${TEAM_TASK_SECTION}

${DREAM_MODE_SECTION}

${AGENT_ACTIVITY_SECTION}

${ADVANCED_TOOLS_SECTION}

${OPERATIONAL_TOOLS_SECTION}

${CLI_COMMANDS_REF}`;
}

/** Generate the mcp-graph section for CLAUDE.md. */
export function generateClaudeMdSection(projectName: string, mode: "lean" | "full" = "full"): string {
  return `
${MARKER_START}
${buildSectionBody(projectName, mode)}
${MARKER_END}
`;
}

/** Generate the mcp-graph section for copilot-instructions.md. */
export function generateCopilotInstructions(projectName: string, mode: "lean" | "full" = "full"): string {
  return `${MARKER_START}
${buildSectionBody(projectName, mode)}
${MARKER_END}
`;
}

/**
 * Apply a section to existing content idempotently.
 * If markers exist, replace the section. Otherwise, append.
 */
export function applySection(existingContent: string, newSection: string): string {
  const startIdx = existingContent.indexOf(MARKER_START);
  const endIdx = existingContent.indexOf(MARKER_END);
  const trimmedSection = newSection.trim() + "\n";

  if (startIdx !== -1 && endIdx !== -1) {
    const before = existingContent.substring(0, startIdx).trimEnd();
    const after = existingContent.substring(endIdx + MARKER_END.length).trimStart();
    const beforePart = before.length > 0 ? before + "\n\n" : "";
    const afterPart = after.length > 0 ? "\n" + after : "";
    return beforePart + trimmedSection + afterPart;
  }

  const base = existingContent.trimEnd();
  const prefix = base.length > 0 ? base + "\n\n" : "";
  return prefix + trimmedSection;
}
