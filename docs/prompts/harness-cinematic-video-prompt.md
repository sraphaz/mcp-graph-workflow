# Prompt Cinematografico: Harness Theory — mcp-graph Lifecycle

> Video sem fala. Apenas visual + tipografia + transicoes + musica ambiente. Estilo: terminal cyberpunk com overlays holograficos.

---

## ABERTURA (0:00 - 0:08)

**Tela preta. Um cursor piscando.**

```
_
```

Lentamente, texto aparece letra por letra em fonte monospacada verde sobre fundo preto:

```
acme-saas/ $ mcp-graph init
```

Particulas de luz se propagam do cursor como circuitos eletricos se conectando. O logo do mcp-graph se forma a partir dessas particulas: um grafo com nodes pulsando.

**Texto overlay (fonte sem-serifa branca, fade in):**

```
HARNESS ENGINEERING
A Cybernetic Governor for AI Agents
```

**Transicao:** As particulas se reorganizam formando a silhueta de um painel de controle.

---

## FRAME 1 — ANALYZE: O Diagnostico (0:08 - 0:22)

**Camera:** Zoom lento em uma tela de terminal.

O comando digita sozinho:

```
$ mcp-graph analyze --mode harness_scan
```

Uma barra de progresso aparece, scaneando. Numeros fluem em cascata estilo Matrix.

O resultado se materializa como um **painel holografico 3D**:

```
╔══════════════════════════════════════════╗
║     HARNESSABILITY SCORE: 52/100        ║
║     ████████████░░░░░░░░░░░  Grade D    ║
╚══════════════════════════════════════════╝
```

As 7 dimensoes aparecem como **barras radiais** girando ao redor do score central — como um HUD de cockpit:

- **Type Coverage 78%** — barra azul, solida
- **Test Coverage 11%** — barra vermelha, pulsando com warning
- **Docs Coverage 85%** — barra azul, solida
- **Arch Fitness 67%** — barra amarela
- **Naming Clarity 72%** — barra azul
- **Error Handling 45%** — barra vermelha, pulsando
- **Context Density 38%** — barra vermelha, pulsando

As 3 barras vermelhas pulsam em sync com um heartbeat sonoro grave.

**Texto overlay (canto inferior):**

```
"O medico examina antes da cirurgia."
```

**Transicao:** As barras vermelhas se transformam em linhas de um ECG (eletrocardiograma), pulsando irregularmente.

---

## FRAME 2 — DESIGN: O Gate Avalia (0:22 - 0:34)

**Camera:** Pan lateral para um segundo monitor.

```
$ mcp-graph analyze --mode design_ready
```

Um **portal holografico** (gate) se materializa — como um arco de seguranca de aeroporto.

Checks passam pelo gate um a um, com efeito de scan verde:

```
✓ has_decisions       → scan verde, pass
✓ has_constraints     → scan verde, pass
✓ no_orphan_reqs      → scan verde, pass
✓ no_cycles           → scan verde, pass
✓ adr_quality         → scan verde, pass
⚠ harness_minimum    → scan amarelo, WARN
```

O ultimo item pisca em amarelo. Uma mensagem holografica flutua:

```
Score 52 < Meta 55
"Pode entrar, mas seus pneus estao gastos."
```

O gate abre parcialmente — luz amarela ao inves de verde.

**Texto overlay:**

```
DESIGN → PLAN
Gate: PASS (with warning)
```

**Transicao:** Camera atravessa o gate parcialmente aberto, entrando no proximo ambiente.

---

## FRAME 3 — PLAN: O Planner Recalcula (0:34 - 0:48)

**Camera:** Vista aerea de um grafo de dependencias — nodes flutuam como constelacoes.

```
$ mcp-graph next
```

Os nodes do grafo se reorganizam em tempo real. Um node com tag `[test]` sobe na hierarquia visual, brilhando mais forte que os outros.

**Animacao:** Uma seta pontilhada aparece conectando o score "11% tests" ao node que subiu. O bonus `+0.5` aparece como particulas douradas sendo absorvidas pelo node.

```
Task #7 (prioridade normal) → desce
Task #1 "Adicionar testes" → sobe (+0.5 harness bonus)
```

O GPS recalcula: uma **rota luminosa** muda de caminho, evitando uma zona vermelha (baixo test coverage) e passando pela zona que corrige primeiro.

**Texto overlay:**

```
"O GPS recalcula a rota.
 Prioriza o caminho que corrige a fraqueza primeiro."
```

**Transicao:** A camera segue a rota luminosa ate o proximo node.

---

## FRAME 4 — IMPLEMENT (Start): Pre-Flight Check (0:48 - 1:02)

**Camera:** Interior de um cockpit. Paineis acendendo.

```
Pipeline: start_task
```

Tres paineis se iluminam em sequencia:

**Painel 1 — CONTEXT:**
```
Task: "Adicionar testes ao auth module"
AC: GIVEN login valido WHEN request THEN JWT
TDD Hints: [unit test, mock db, assert token]
```

**Painel 2 — HARNESS PRE-FLIGHT:**
Um gauge analogico estilo velocimetro gira de 0 ate 52. A agulha para na zona vermelha.
```
⚠ Score: 52 (Grade D)
  "High hallucination risk"
```

**Painel 3 — DECISAO:**
Tres linhas de texto aparecem como checklist do piloto:
```
→ Ser conservador nas inferencias
→ Perguntar antes de assumir
→ Escrever testes granulares
```

Cada linha aparece com um efeito de "carimbo" — stamp visual.

**Texto overlay:**

```
PRE-FLIGHT COMPLETE
Cleared for implementation
```

**Transicao:** O cockpit fecha a canopy. Motores ligam.

---

## FRAME 5 — IMPLEMENT (TDD): Guides + Sensors (1:02 - 1:22)

**Camera:** Split screen — esquerda: codigo, direita: terminal.

**Esquerda (GUIDE - Feedforward):**

Arquivos aparecem como camadas transparentes empilhadas:
```
CLAUDE.md ───────────── convenções
.claude/rules/ ──────── regras auto-geradas
context() ───────────── dependências
rag_context() ───────── docs (boost: testing)
tddHints ────────────── estrutura do teste
pre-flight ──────────── "cuidado, score D"
```

Seta desce → entra no "agente"

**Centro (AGENTE IMPLEMENTA):**

Tres fases aparecem como tres atos de um ciclo:

**RED:** Tela vermelha. `auth.test.ts` aparece. Teste roda. `✗ FAIL`. Cor vermelha pulsa.

**GREEN:** Tela muda para verde. `auth.ts` aparece ao lado. Codigo minimo. `✓ PASS`. Brilho verde.

**REFACTOR:** Tela azul. Cleanup visual — linhas se reorganizam elegantemente. `✓ STILL PASSING`.

**Direita (SENSOR - Feedback):**

```
vitest run → 91/91 ✓
DoD checks → 8/8 Grade A
IssueTracker → 0 new patterns
Score: 52 → 58 (+6!) ↑
```

O numero **58** aparece grande, com particulas douradas subindo (+6).

**Texto overlay:**

```
FEEDFORWARD → IMPLEMENT → FEEDBACK
O teste que o agente escreveu MELHOROU o score
```

---

## FRAME 6 — FINISH TASK: Regression Check (1:22 - 1:34)

**Camera:** Zoom no painel de instrumentos.

```
Pipeline: finish_task
```

**DoD Report** aparece como um checklist com 8 items, cada um com animacao de check verde:

```
✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓
Grade A — 100/100
```

**Harness Post-Check:** O gauge do velocimetro gira de 52 para 58. A agulha sai da zona vermelha e entra na amarela.

```
harnessRegression: null
Delta: +6 (melhorou!)
```

Um **snapshot** e salvo — efeito de fotografia, flash branco rapido:

```
{ score: 58, grade: "C", git: "a1b2c3d" }
```

**Transicao:** O snapshot se miniaturiza e entra em um timeline horizontal na parte inferior da tela.

---

## FRAME 7 — VALIDATE: Estabilidade (1:34 - 1:42)

**Camera:** O gate VALIDATE se materializa — maior que o anterior.

```
$ mcp-graph analyze --mode validate_ready
```

Scans passam:
```
✓ all_tasks_done
✓ test_coverage_adequate
✓ ac_validated
✓ harness_no_regression
```

Uma comparacao visual aparece:

```
ANTES: ████████████░░░░░░░░  52 (D)
AGORA: ██████████████░░░░░░  58 (C)
                          Δ +6
```

Gate abre com luz verde.

---

## FRAME 8 — REVIEW (1:42 - 1:48)

**Camera:** Gate REVIEW — com scanner mais intenso.

```
✓ blast_radius_acceptable
✓ harness_grade >= C (58, meta: 55)
```

**Texto flutuante:**

```
"Nota C — minimo para review.
 Melhore para B antes do deploy."
```

---

## FRAME 9 — DEPLOY: Gate Rigoroso (1:48 - 1:58)

**Camera:** O maior gate — vermelho, com laser de verificacao.

```
⚠ harness_deploy_grade
  Score: 58 (Grade C)
  Meta: >= B (70)
```

Duas opcoes aparecem como bifurcacao na estrada:

```
← Opcao A: Deploy (aceitar risco)
→ Opcao B: Sprint de melhoria
```

A seta luminosa escolhe o caminho A. O gate abre com luz amarela.

---

## FRAME 10 — LISTENING: Baseline (1:58 - 2:08)

**Camera:** Vista panoramica. O timeline horizontal na parte inferior mostra 3 pontos:

```
┌─────────┬─────────┬─────────┐
│ 52 (D)  │ 55 (C)  │ 58 (C)  │
│ inicio  │  meio   │ deploy  │
└─────────┴─────────┴─────────┘
     ↗         ↗         ↗
   trend: "improving"
```

Uma linha conecta os 3 pontos — curva ascendente.

**Texto overlay:**

```
Baseline salvo: 58 (C)
Proximo ciclo: meta 70 (B)
```

---

## FRAME 11 — STEERING LOOP: Auto-Melhoria (2:08 - 2:22)

**Camera:** Close-up no IssuePatternTracker.

Tres falhas aparecem como strikes:

```
missing_ac (1/3) ██░░░
missing_ac (2/3) ████░
missing_ac (3/3) ██████ ← THRESHOLD!
```

Efeito de alarme silencioso — flash dourado.

Uma **regra** se auto-gera, materializando-se como um documento holografico:

```
┌──────────────────────────────────────┐
│  # Rule: Acceptance Criteria Required │
│  Every task must have at least 2      │
│  testable acceptance criteria         │
│  before moving to in_progress.        │
│  Use Given-When-Then format.          │
└──────────────────────────────────────┘
```

O documento flutua e se posiciona em `.claude/rules/missing-ac.md`.

**Texto overlay:**

```
"O sistema aprendeu sozinho.
 Proxima vez, o agente ja sabe a regra."
```

---

## FRAME 12 — LOOP COMPLETO: Visao Orbital (2:22 - 2:40)

**Camera:** Zoom out dramatico. O grafo inteiro aparece como uma galaxia.

As 9 fases do lifecycle formam um **anel orbital** ao redor do projeto:

```
    ANALYZE ─── DESIGN ─── PLAN
       │                      │
   LISTENING              IMPLEMENT
       │                      │
    DEPLOY ─── HANDOFF ─── VALIDATE
                  │
               REVIEW
```

Cada fase tem um **gauge** de harness flutuando ao lado.

O score `{ 58, C }` aparece **em todas as fases** como um HUD persistente.

**Zoom final:** O score central pulsa como um coracao — cada batida e uma tool call respondendo com `_lifecycle.harness`.

---

## ENCERRAMENTO (2:40 - 2:55)

**Tela divide em dois:**

**Esquerda — SEM HARNESS:**
Silhueta de um piloto vendado batendo em paredes. Caos. Linhas vermelhas.
```
Cego → Bate → Conserta → Bate
```

**Direita — COM HARNESS:**
Cockpit iluminado. Dashboard claro. Rota verde.
```
Painel → GPS → Pit Stop → Gates → Telemetria → Auto-Correcao
```

Os dois lados se fundem no centro. A versao com harness prevalece.

**Texto final (grande, centralizado):**

```
HARNESS ENGINEERING

"A cybernetic governor combining
 feedforward and feedback to regulate
 the codebase towards its desired state."

                     — Böckeler, 2026
```

---

## CREDITS (2:55 - 3:00)

Fundo preto. Texto minimalista.

```
mcp-graph v8.0
Spec-Driven Development Platform

6 epics · 22 tasks · 180+ tests · zero regressions
Built with TDD, tracked in the graph

github.com/mcp-graph-workflow
```

---

## NOTAS DE PRODUCAO

### Estilo Visual
- **Palette:** Preto (#0a0a0a), verde terminal (#00ff41), azul (#0066ff), vermelho (#ff3333), dourado (#ffd700)
- **Fonte terminal:** JetBrains Mono ou Fira Code
- **Fonte overlay:** Inter ou SF Pro
- **Efeitos:** Glow neon, particulas, hologramas translucidos
- **Transicoes:** Morphing de particulas entre frames

### Musica
- Ambient electronica minimalista
- Pulso grave sincronizado com heartbeat do score
- Crescendo sutil nos momentos de gate pass
- Drone baixo nos warnings

### Duracao
- Total: ~3 minutos
- Ritmo: lento nos diagnosticos, rapido no TDD cycle, dramatico nos gates

### Ferramentas Sugeridas
- After Effects / Motion para animacoes de terminal
- Blender para hologramas 3D
- Midjourney/DALL-E para concept art dos frames
- Runway ML para transicoes generativas
