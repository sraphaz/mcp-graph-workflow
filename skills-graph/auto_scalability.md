---
name: auto-scalability
description: Detectar automaticamente necessidades de escala no mcp-graph-workflow e aplicar escalabilidade horizontal/vertical de forma proativa
triggers:
  - auto-scalability
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# AutoScalability Skill – Escalabilidade Automática e Inteligente

**Nome da Skill:** auto_scalability
**Versão:** 1.0 (10/04/2026)
**Objetivo:** Detectar automaticamente necessidades de escala no mcp-graph-workflow (aumento de tasks, tamanho do grafo, carga de hybrid search, etc.) e aplicar escalabilidade horizontal/vertical de forma proativa, usando o estado da arte de cloud-native e agentic systems, sem perder o foco local-first. Integra com PerformanceAnalysis (medição), ProactiveMonitoring (previsão), SelfHealing (correção) e NirvanaForge (roadmap para Nirvana).

## O que esta skill faz?

- Monitora continuamente métricas de carga (número de tasks ativas, tempo de traversal, uso de memória/CPU, tamanho do grafo SQLite, throughput do pipeline).
- Previsão de demanda usando Little's Law + séries temporais.
- Aplica escalabilidade automática:
  - Local: aumenta threads de paralelismo, particiona o grafo, cria worker pools dinâmicos.
  - Opcional cloud: sugere ou ativa "burst" para managed graph (premium feature).
- Ajusta automaticamente parâmetros (ex: BM25 + embeddings, phase-aware boosting).
- Registra histórico de escalas e evolui as regras de scaling com base em resultados.

## Como usar (muito simples)

1. Salve este arquivo em `skills-graph/auto_scalability.md`
2. Rode no terminal:
   ```bash
   analyze auto_scalability self
   ```
   ou
   ```bash
   start_task auto_scalability --mode=auto --scope=full_graph
   ```
3. A skill vai:
   - Analisar carga atual e prever pico.
   - Aplicar scaling imediato ou criar plano.
   - Atualizar o grafo com tasks de otimização.

## Metodologia (SOTA 2025-2026)

- **Little's Law** (L = λW) + **Amdahl's Law** para decidir quando paralelizar e quanto (integração direta com PerformanceAnalysis).
- **Predictive Auto-Scaling** (AIOps + papers Kubernetes HPA 2026 e LangGraph dynamic workers).
- **Graph Partitioning** (METIS ou spectral clustering para grandes grafos de tasks).
- **MAPE-K loop** integrado com as outras skills de auto-gestão.
- **Buyer-based Open Core:** core local-first continua gratuito; premium = managed horizontal scaling (como Supabase ou GitLab Cloud).

## Output gerado (salvo automaticamente no grafo)

- **Scalability Score** atual (0-100) + projeção de crescimento.
- **Plano de scaling** aplicado ou sugerido (ex: "+4 worker threads → throughput +42%").
- **Tasks automáticas** criadas no sub-grafo NirvanaRoadmap (ex: "Implementar dynamic worker pool").
- **Relatório de métricas** antes/depois + histórico (node "AutoScalingLog").
- **Sugestão de feature premium:** "mcp-graph-cloud – auto-scale managed".

## Próxima ação automática

Após rodar, a skill cria automaticamente a task: **DESIGN → Implementar Dynamic Worker Pool + Graph Partitioning** (alcançar escalabilidade linear)

## Ciclo completo de auto-gestão Nirvana

Esta skill fecha o ciclo completo:

| Skill | Função |
|-------|--------|
| **ProactiveMonitoring** | Prevê |
| **PerformanceAnalysis** | Mede |
| **AutoScalability** | Escala |
| **SelfHealing** | Corrige |
| **NirvanaForge** | Planeja o futuro |
