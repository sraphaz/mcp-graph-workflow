# `scripts/perf/` — Performance baseline harness

Reproduzível, sem dependências externas. Mede performance da CLI `mcp-graph` e detecta regressões.

## Quick start

```bash
# Build first (script mede o bin compilado)
npm run build

# Roda e imprime relatório humano (não persiste)
node scripts/perf/measure.mjs

# Roda e salva baseline em scripts/perf/perf-baseline.json
node scripts/perf/measure.mjs --save

# Modo CI: falha se regressão >10% vs baseline
node scripts/perf/measure.mjs --check

# Saída JSON (machine-readable)
node scripts/perf/measure.mjs --json

# Customiza número de runs (padrão 5)
node scripts/perf/measure.mjs --runs=10
```

## Métricas

| Métrica | Descrição | Target v10.2.0 |
|---|---|---|
| `cliColdHelpMs` | Tempo de cold start de `mcp-graph --help` (mediana) | ≤ 150 ms |
| `cliStatusJsonMs` | Tempo de `mcp-graph stats --json` (mediana) | ≤ 200 ms |
| `serveBootMs` | Tempo até `mcp-graph serve` emitir "listening" | ≤ 1000 ms |
| `rssAfterHelpMb` | RSS (MB) após `--help` | ≤ 80 MB |
| `distBinSizeBytes` | Tamanho do bin resolvido (`dist/cli/index.js` ou novo `dist/bin/`) | ≤ 4 MB |
| `distSizeBytes` | Tamanho total de `dist/` (informativo) | — |

## Como o `--check` funciona

1. Lê `scripts/perf/perf-baseline.json` (gerado por `--save` em commit anterior).
2. Compara cada métrica numérica ao valor atual.
3. Falha (exit 1) se qualquer métrica regrediu mais de **10%**.
4. Use em CI antes de mergear PRs que mexem em CLI/MCP server boot path.

## Re-baseline

Quando uma melhoria intencional acontece (e quer mover o piso):

```bash
npm run build
node scripts/perf/measure.mjs --save
git add scripts/perf/perf-baseline.json
git commit -m "perf: rebaseline after T2.4 (tsup bundler)"
```

Sempre **rebaseline em commit dedicado**, sem misturar com outros mudanças, para que `git blame` mostre claramente quem mexeu na régua.

## Notas técnicas

- O script é puro Node ESM (`.mjs`), zero deps externas. Roda sobre o Node em `engines.node` (≥20).
- Cada métrica roda 5 vezes (configurável via `--runs`); usa **mediana** (não média) para resistir a outliers de I/O do macOS.
- `serveBootMs` usa portas únicas por run (13900, 13901, ...) e mata o processo via `SIGTERM` após detectar o marker. Hard-timeout de 6s por attempt.
- O nome da subcommand `status` ainda é `stats` no CLI atual; quando T1.3 (non-interactive runner) renomear, atualizar `args` em `measureCommand({label: "cliStatusJsonMs", ...})`.

## Contexto do plano

Faz parte de **T2.1 da v10.2.0 DX Overhaul** (node `node_8fbf4a00caf3`). Plano completo: `~/.claude/plans/witty-booping-bunny.md`.
