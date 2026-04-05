# graph-* Skills — Guia Completo

## O que sao

30 skills de engenharia de software organizadas em 5 categorias, cobrindo o ciclo completo de desenvolvimento — da ideacao ao monitoramento pos-deploy.

## Compatibilidade

| Plataforma | Compativel? | Formato | Localizacao |
|---|---|---|---|
| **Claude Code** | Sim (nativo) | SKILL.md em diretorio | `~/.claude/skills/<name>/SKILL.md` |
| **GitHub Copilot** | Sim (com ajustes) | `.github/copilot-instructions.md` ou custom instructions | `.github/copilot-instructions.md` |
| **Codex CLI** | Sim (com ajustes) | `AGENTS.md` ou instructions file | `.codex/AGENTS.md` |

### Diferencias entre plataformas

**Claude Code** usa SKILL.md como prompt template — invocado via `/skill-name`. O formato atual e 100% compativel.

**GitHub Copilot** usa `copilot-instructions.md` para instrucoes customizadas. As skills precisam ser adaptadas: remover referencias a MCP tools (`mcp__mcp-graph__*`) e focar no checklist/metodologia. Copilot nao tem MCP integration, entao as partes de `start_task`/`finish_task` nao se aplicam.

**Codex CLI** usa `AGENTS.md` como instrucoes. Formato similar ao Claude Code mas sem slash commands.

## Configuracao

### Claude Code (nativo)

```bash
# Opcao 1: Symlink (recomendado — auto-atualiza com git pull)
for skill in skills-graph/graph-*.md; do
  name=$(basename "$skill" .md)
  mkdir -p ~/.claude/skills/$name
  ln -sf "$(pwd)/$skill" ~/.claude/skills/$name/SKILL.md
done

# Opcao 2: Copiar manualmente
for skill in skills-graph/graph-*.md; do
  name=$(basename "$skill" .md)
  mkdir -p ~/.claude/skills/$name
  cp "$skill" ~/.claude/skills/$name/SKILL.md
done
```

Verificar instalacao:
```bash
ls ~/.claude/skills/graph-*/SKILL.md | wc -l
# Esperado: 30
```

Uso:
```
/graph-prd        # Criar PRD com 7 metodologias
/graph-implement  # Implementar tasks com TDD
/graph-security   # Audit OWASP + STRIDE
```

### GitHub Copilot

Copilot usa instrucoes via `.github/copilot-instructions.md`. Para usar as skills:

```bash
# Opcao 1: Concatenar skills relevantes no copilot-instructions.md
cat skills-graph/graph-security.md skills-graph/graph-tests.md \
    skills-graph/graph-quality-assurance.md \
    > .github/copilot-instructions.md

# Opcao 2: Referenciar como contexto (Copilot Chat)
# No Copilot Chat, use @workspace e referencie os arquivos:
# "Siga as instrucoes em skills-graph/graph-security.md para fazer audit de seguranca"
```

**Limitacoes do Copilot:**
- Sem MCP tools — ignore secoes que referenciam `mcp__mcp-graph__*`
- Sem slash commands — use como referencia de checklist/metodologia
- Sem lifecycle tracking — foco nos steps interativos

**Adaptacao recomendada:** Use as skills como checklists de revisao no PR review do Copilot.

### Codex CLI

```bash
# Copiar skills para instrucoes do Codex
mkdir -p .codex
cat skills-graph/graph-implement.md skills-graph/graph-tests.md \
    > .codex/AGENTS.md
```

## Catalogo de Skills (30)

### Pre-Lifecycle (1)

| Skill | Trigger | Descricao | Metodologias |
|---|---|---|---|
| `graph-prd` | `/graph-prd` | Transforma ideia vaga em PRD estruturado | 5W2H, JTBD, Pareto 80/20, MoSCoW, INVEST, Given-When-Then, Risk Matrix |

### Lifecycle — 9 fases sequenciais (1)

| Skill | Trigger | Fase | Descricao |
|---|---|---|---|
| `graph-analyze` | `/graph-analyze` | ANALYZE | Import PRD, Definition of Ready (7 checks) |
| `graph-design` | `/graph-design` | DESIGN | Arquitetura, ADRs, impact analysis |
| `graph-plan` | `/graph-plan` | PLAN | Sprint planning, decomposicao atomica, velocity |
| `graph-implement` | `/graph-implement` | IMPLEMENT | TDD Red-Green-Refactor, start_task/finish_task |
| `graph-validate` | `/graph-validate` | VALIDATE | E2E tests, AC verification, DORA metrics |
| `graph-review` | `/graph-review` | REVIEW | Blast radius, code sync, code review |
| `graph-handoff` | `/graph-handoff` | HANDOFF | PR creation, documentation, knowledge capture |
| `graph-deploy` | `/graph-deploy` | DEPLOY | CI pipeline, release, post-validation |
| `graph-listening` | `/graph-listening` | LISTENING | Feedback, DORA retrospective, next cycle |

### Cross-Cutting — Quality (6)

| Skill | Trigger | Descricao | Metodologias |
|---|---|---|---|
| `graph-security` | `/graph-security` | Audit de seguranca | OWASP Top 10, STRIDE, secrets scan, dependency audit |
| `graph-quality-assurance` | `/graph-quality-assurance` | Qualidade de codigo | Clean Code, SOLID, DRY, McCabe complexity |
| `graph-tests` | `/graph-tests` | Estrategia de testes | Test Pyramid, FIRST, coverage, edge cases |
| `graph-observability` | `/graph-observability` | Observabilidade | Three Pillars, RED/USE, OpenTelemetry, ECS |
| `graph-bug-hunter` | `/graph-bug-hunter` | Descoberta de bugs | Static analysis, LSP diagnostics, hotspots |
| `graph-fix-bugs` | `/graph-fix-bugs` | Correcao de bugs | 5 Whys, TDD for bugs, regression prevention |

### Cross-Cutting — Engineering (4)

| Skill | Trigger | Descricao | Metodologias |
|---|---|---|---|
| `graph-performance` | `/graph-performance` | Performance | Lighthouse, Web Vitals, N+1, memory profiling |
| `graph-refactor` | `/graph-refactor` | Tech debt | SQALE, complexity, dead code, KISS/YAGNI/DRY |
| `graph-api-design` | `/graph-api-design` | Governanca de API | OpenAPI, REST maturity, contract validation |
| `graph-dependency` | `/graph-dependency` | Dependencias | SBOM, license compliance, supply chain security |

### Cross-Cutting — Operations (4)

| Skill | Trigger | Descricao | Metodologias |
|---|---|---|---|
| `graph-incident` | `/graph-incident` | Resposta a incidentes | Postmortem, 5 Whys RCA, runbooks, SLA tracking |
| `graph-cicd` | `/graph-cicd` | Pipeline CI/CD | GitHub Actions optimization, flaky tests, caching |
| `graph-dx` | `/graph-dx` | Developer Experience | DX Core 4, SPACE, cognitive load, onboarding |
| `graph-accessibility` | `/graph-accessibility` | Acessibilidade | WCAG 2.2 AA, ARIA, screen reader, i18n |

### Cross-Cutting — Governance (6)

| Skill | Trigger | Descricao | Metodologias |
|---|---|---|---|
| `graph-architecture` | `/graph-architecture` | Arquitetura | C4 Model, ADR lifecycle, fitness functions |
| `graph-release` | `/graph-release` | Release management | Semver, changelog, feature flags, canary |
| `graph-cost` | `/graph-cost` | Custo | FinOps, token budget, CI/CD minutes |
| `graph-monitoring` | `/graph-monitoring` | Monitoramento | SLOs, alert rules, dashboards, anomaly detection |
| `graph-migration` | `/graph-migration` | Migracoes | Schema safety, rollback plans, drift detection |
| `graph-docs` | `/graph-docs` | Documentacao | CLAUDE.md, JSDoc, README, API docs |

## Fluxo recomendado

```
Ideia → /graph-prd → /graph-analyze → /graph-design → /graph-plan
     → /graph-implement → /graph-validate → /graph-review
     → /graph-handoff → /graph-deploy → /graph-listening → novo ciclo

A qualquer momento, use cross-cutting skills:
  /graph-security     (antes de deploy)
  /graph-tests        (apos implement)
  /graph-performance  (antes de release)
  /graph-refactor     (durante listening)
```

## Fontes e frameworks utilizados

- OWASP Top 10, STRIDE (seguranca)
- Clean Code, SOLID, DRY, KISS, YAGNI (qualidade)
- Test Pyramid, FIRST (testes)
- Three Pillars, RED/USE, OpenTelemetry, ECS (observabilidade)
- DORA, SPACE, DX Core 4 (metricas)
- SQALE (tech debt)
- C4 Model (arquitetura)
- WCAG 2.2 AA (acessibilidade)
- FinOps (custos)
- 5W2H, JTBD, Pareto, MoSCoW, INVEST, Given-When-Then (PRD)
