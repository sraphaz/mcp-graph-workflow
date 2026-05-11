#!/usr/bin/env tsx
/**
 * PRD Enricher Script
 *
 * Audit + enriquece PRDs em docs/prd/ com base em convenções do skill graph-prd
 * + regras de anti-alucinação. Standalone, roda via `npx tsx scripts/prd-enricher.ts`.
 *
 * Modes:
 *   audit                - default; gera docs/_internal/prd-audit.md (não modifica PRDs)
 *   enrich --dry-run     - mostra blocos ENRICHER que seriam adicionados
 *   enrich --apply       - escreve blocos ENRICHER inline nos PRDs
 *   validate --strict    - exit 1 se houver issues severity=error
 *   clean                - remove blocos ENRICHER previamente aplicados (rollback)
 *
 * Deviation from plan: 8 módulos colapsados em 1 arquivo (~600 LOC) para
 * ergonomia de script one-off. Se crescer >800 LOC, splitar.
 */

import { promises as fs } from 'node:fs';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  scoreInvest,
  type InvestScore,
  tarjanScc,
  kahnTopologicalSort,
  criticalPath,
  suggestNearestPath,
  inDegreeCentrality,
  scoreIeee830,
  type Ieee830Score,
} from './prd-enricher/methodologies.js';

// ============================================================================
// CONFIG
// ============================================================================

const PROJECT_ROOT = path.resolve(process.cwd());
const PRD_DIR = path.join(PROJECT_ROOT, 'docs/prd');
const AUDIT_OUT = path.join(PROJECT_ROOT, 'docs/_internal/prd-audit.md');

const ENRICHER_START = '<!-- ENRICHER:start -->';
const ENRICHER_END = '<!-- ENRICHER:end -->';

// Forbidden phrases lidas dinamicamente de .claude/rules/anti-hallucination.md
// Fallback hardcoded se arquivo ausente/parse falhar.
const FORBIDDEN_PHRASES_FALLBACK: { phrase: RegExp; suggestion: string }[] = [
  { phrase: /\bstandard practice\b/gi, suggestion: 'name the actual standard (RFC/spec/ADR)' },
  { phrase: /\btypically\b/gi, suggestion: 'replace with measurement or remove' },
  { phrase: /\bobviously\b/gi, suggestion: 'remove (if obvious, comment unnecessary)' },
  { phrase: /\bnormally\b/gi, suggestion: 'replace with measurement' },
  { phrase: /\bas expected\b/gi, suggestion: 'describe what is expected and why' },
  { phrase: /\bbest practice\b/gi, suggestion: 'cite the source (style guide, RFC, paper)' },
  { phrase: /\bcommon pattern\b/gi, suggestion: 'name the pattern + concrete reference' },
];

let FORBIDDEN_PHRASES: { phrase: RegExp; suggestion: string }[] = FORBIDDEN_PHRASES_FALLBACK;

async function loadForbiddenPhrases(): Promise<void> {
  const rulePath = path.join(PROJECT_ROOT, '.claude/rules/anti-hallucination.md');
  if (!existsSync(rulePath)) return;
  try {
    const content = await fs.readFile(rulePath, 'utf8');
    const phrases: { phrase: RegExp; suggestion: string }[] = [];
    // formato: "- **\"phrase\"** — suggestion"
    const re = /^-\s+\*\*"([^"]+)"\*\*\s+—\s+(.+)$/gm;
    for (const m of content.matchAll(re)) {
      const phrase = m[1].trim();
      const suggestion = m[2].trim();
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      phrases.push({ phrase: new RegExp(`\\b${escaped}\\b`, 'gi'), suggestion });
    }
    if (phrases.length > 0) FORBIDDEN_PHRASES = phrases;
  } catch {
    // mantém fallback
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface PrdTask {
  id: string;
  title: string;
  size?: string;
  priority?: string;
  tags?: string[];
  dependsOn?: string[];
  acceptanceCriteria: string[];
  body: string;
  startLine: number;
  endLine: number;
}

interface PrdEpic {
  title: string;
  body: string;
  tasks: PrdTask[];
  startLine: number;
}

interface PrdPhase {
  title: string;
  epics: PrdEpic[];
  startLine: number;
}

interface CriticalFiles {
  create: string[];
  modify: string[];
  delete: string[];
  rename: { from: string; to: string }[];
  reuse: string[];
}

interface Prd {
  filePath: string;
  fileName: string;
  title: string;
  sections: Map<string, { startLine: number; endLine: number; body: string }>;
  phases: PrdPhase[];
  crossRefs: string[]; // outras PRDs referenciadas
  criticalFiles: CriticalFiles;
  rawContent: string;
  rawLines: string[];
  bodyWithoutEnricher: string;
}

interface CheckIssue {
  checkId: string;
  severity: 'error' | 'warn' | 'info';
  prdFile: string;
  line?: number;
  message: string;
}

// ============================================================================
// PARSING
// ============================================================================

function stripEnricherBlock(content: string): string {
  const startIdx = content.indexOf(ENRICHER_START);
  if (startIdx === -1) return content;
  const endIdx = content.indexOf(ENRICHER_END, startIdx);
  if (endIdx === -1) return content;
  return content.slice(0, startIdx) + content.slice(endIdx + ENRICHER_END.length).replace(/^\n+/, '\n');
}

function extractCriticalFiles(body: string): CriticalFiles {
  const result: CriticalFiles = { create: [], modify: [], delete: [], rename: [], reuse: [] };
  const sections: { name: keyof CriticalFiles | 'rename'; regex: RegExp }[] = [
    { name: 'create', regex: /\*\*Criar:\*\*/i },
    { name: 'modify', regex: /\*\*Modificar:\*\*/i },
    { name: 'delete', regex: /\*\*Deletar:\*\*/i },
    { name: 'rename', regex: /\*\*Renomear:\*\*/i },
    { name: 'reuse', regex: /\*\*Reaproveitar.*?:\*\*/i },
  ];

  const lines = body.split('\n');
  let currentBucket: keyof CriticalFiles | 'rename' | null = null;

  for (const line of lines) {
    const matched = sections.find((s) => s.regex.test(line));
    if (matched) {
      currentBucket = matched.name;
      continue;
    }
    if (!currentBucket) continue;
    if (line.trim() === '' || /^\*\*[A-Z]/.test(line.trim())) {
      // possível início de novo bucket; continue para a próxima iteração reavaliar
      currentBucket = null;
      continue;
    }
    // bullet?
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (!bulletMatch) continue;
    const inner = bulletMatch[1];

    // tenta extrair paths em backticks
    const backtickPaths = [...inner.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (backtickPaths.length === 0) continue;

    if (currentBucket === 'rename') {
      // formato: `from` → `to`
      if (backtickPaths.length >= 2) {
        result.rename.push({ from: backtickPaths[0], to: backtickPaths[1] });
      }
    } else {
      for (const p of backtickPaths) {
        // normaliza: remove patterns como (todo), comentários, etc
        const cleaned = p.split(/\s/)[0].trim();
        if (cleaned && !cleaned.startsWith('§') && !cleaned.startsWith('http')) {
          result[currentBucket].push(cleaned);
        }
      }
    }
  }

  return result;
}

function extractCrossRefs(content: string, allPrdNames: Set<string>): string[] {
  const found = new Set<string>();
  // matches `xyz.md` OR docs/prd/xyz.md
  const re = /(?:docs\/prd\/|`)([a-z][a-z0-9-]+\.md)/gi;
  for (const m of content.matchAll(re)) {
    if (allPrdNames.has(m[1])) found.add(m[1]);
  }
  return [...found];
}

function parseTask(taskLines: string[], startLine: number, taskTitle: string, taskId: string): PrdTask {
  const body = taskLines.join('\n');
  const task: PrdTask = {
    id: taskId,
    title: taskTitle,
    acceptanceCriteria: [],
    body,
    startLine,
    endLine: startLine + taskLines.length - 1,
  };

  for (let i = 0; i < taskLines.length; i++) {
    const line = taskLines[i];
    const trimmed = line.trim();

    // Tamanho
    const sizeM = trimmed.match(/^\*\*Tamanho:?\*\*\s*([XSML]+)/i);
    if (sizeM) task.size = sizeM[1].toUpperCase();

    // Tamanho/Prioridade combinados via |
    const combined = trimmed.match(/^\*\*Tamanho:?\*\*\s*([XSML]+)\s*\|\s*\*\*Prioridade:?\*\*\s*(\d+)/i);
    if (combined) {
      task.size = combined[1].toUpperCase();
      task.priority = combined[2];
    }

    // Prioridade isolada
    const prioM = trimmed.match(/^\*\*Prioridade:?\*\*\s*(\d+)/i);
    if (prioM && !task.priority) task.priority = prioM[1];

    // Tags
    const tagsM = trimmed.match(/\*\*Tags:?\*\*\s*(.+)$/i);
    if (tagsM) {
      task.tags = tagsM[1].split(',').map((s) => s.trim()).filter(Boolean);
    }

    // Depende de
    const depM = trimmed.match(/\*\*Depende de:?\*\*\s*(.+)$/i);
    if (depM) {
      task.dependsOn = depM[1].split(',').map((s) => s.trim()).filter(Boolean);
    }

    // AC start: a partir daqui, lê bullets até nova bold key ou fim
    if (/^\*\*Crit[ée]rios de aceite:?\*\*/i.test(trimmed)) {
      for (let j = i + 1; j < taskLines.length; j++) {
        const ac = taskLines[j].trim();
        if (ac === '') break;
        if (/^\*\*[A-Z][\w\s]*:?\*\*/.test(ac)) break;
        const bullet = ac.match(/^[-*]\s+(.+)$/);
        if (bullet) task.acceptanceCriteria.push(bullet[1]);
      }
    }
  }

  return task;
}

async function parsePrd(filePath: string): Promise<Prd> {
  const rawContent = await fs.readFile(filePath, 'utf8');
  const bodyWithoutEnricher = stripEnricherBlock(rawContent);
  const rawLines = bodyWithoutEnricher.split('\n');
  const fileName = path.basename(filePath);

  // título: primeiro H1
  let title = fileName;
  const h1Idx = rawLines.findIndex((l) => /^#\s+/.test(l));
  if (h1Idx >= 0) title = rawLines[h1Idx].replace(/^#\s+/, '').trim();

  // sections (H2)
  const sections = new Map<string, { startLine: number; endLine: number; body: string }>();
  const phases: PrdPhase[] = [];
  let currentSectionName: string | null = null;
  let currentSectionStart = 0;
  let currentPhase: PrdPhase | null = null;
  let currentEpic: PrdEpic | null = null;
  let currentTaskLines: string[] | null = null;
  let currentTaskTitle = '';
  let currentTaskId = '';
  let currentTaskStart = 0;

  const flushTask = () => {
    if (currentTaskLines && currentEpic) {
      currentEpic.tasks.push(parseTask(currentTaskLines, currentTaskStart, currentTaskTitle, currentTaskId));
    }
    currentTaskLines = null;
  };
  const flushSection = (endLine: number) => {
    if (currentSectionName !== null) {
      const body = rawLines.slice(currentSectionStart, endLine).join('\n');
      sections.set(currentSectionName, { startLine: currentSectionStart, endLine, body });
    }
  };

  let inCodeBlock = false;
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Track fenced code blocks (``` em qualquer indentação <=3 spaces)
    if (/^\s{0,3}```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      if (currentTaskLines !== null) currentTaskLines.push(line);
      continue;
    }
    if (inCodeBlock) {
      if (currentTaskLines !== null) currentTaskLines.push(line);
      continue;
    }

    // H2: section
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      flushTask();
      currentEpic = null;
      flushSection(i);
      currentSectionName = h2[1].trim();
      currentSectionStart = i + 1;

      // se for "Fase N — ..."
      const phaseM = currentSectionName.match(/^Fase\s+(\d+)/i);
      if (phaseM) {
        currentPhase = { title: currentSectionName, epics: [], startLine: i };
        phases.push(currentPhase);
      } else {
        currentPhase = null;
      }
      continue;
    }

    // H3: epic
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3 && currentPhase) {
      flushTask();
      currentEpic = { title: h3[1].trim(), body: '', tasks: [], startLine: i };
      currentPhase.epics.push(currentEpic);
      continue;
    }

    // H4: task
    const h4 = line.match(/^####\s+(?:Task\s+)?(\S+):\s*(.+)$/);
    if (h4 && currentPhase) {
      // Se task aparece sem Epic explícito, cria Epic sintético
      if (!currentEpic) {
        currentEpic = { title: '(implicit epic)', body: '', tasks: [], startLine: i };
        currentPhase.epics.push(currentEpic);
      }
      flushTask();
      currentTaskId = h4[1].replace(':', '');
      currentTaskTitle = h4[2].trim();
      currentTaskLines = [];
      currentTaskStart = i;
      continue;
    }

    if (currentTaskLines !== null) {
      // se outro H? começou, deixa o loop normal cuidar (já tratado acima)
      currentTaskLines.push(line);
    }
  }
  flushTask();
  flushSection(rawLines.length);

  // cross-refs serão preenchidos depois (precisa lista de todas PRDs)
  const criticalFilesSection = sections.get('Critical Files');
  const criticalFiles = criticalFilesSection
    ? extractCriticalFiles(criticalFilesSection.body)
    : { create: [], modify: [], delete: [], rename: [], reuse: [] };

  return {
    filePath,
    fileName,
    title,
    sections,
    phases,
    crossRefs: [], // preenchido em main()
    criticalFiles,
    rawContent,
    rawLines,
    bodyWithoutEnricher,
  };
}

// ============================================================================
// CHECKS
// ============================================================================

const REQUIRED_SECTIONS_ERROR = ['Context'];
const REQUIRED_SECTIONS_WARN = ['Riscos', 'Restrições', 'Critical Files', 'Verification'];

function runChecks(prd: Prd, allPrdNames: Set<string>, allPrds: Map<string, Prd>): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const push = (ci: Omit<CheckIssue, 'prdFile'>) => issues.push({ ...ci, prdFile: prd.fileName });

  // Section presence
  for (const sec of REQUIRED_SECTIONS_ERROR) {
    if (!prd.sections.has(sec)) {
      push({ checkId: 'missing-section-' + sec.toLowerCase(), severity: 'error', message: `Falta seção '## ${sec}'` });
    }
  }
  for (const sec of REQUIRED_SECTIONS_WARN) {
    if (!prd.sections.has(sec)) {
      push({
        checkId: 'missing-section-' + sec.toLowerCase().replace(/\s+/g, '-'),
        severity: 'warn',
        message: `Falta seção '## ${sec}'`,
      });
    }
  }
  // "O que não está" — match flexível
  const hasNotIncluded = [...prd.sections.keys()].some((k) => /n[ãa]o est[áa]/i.test(k));
  if (!hasNotIncluded) {
    push({ checkId: 'missing-section-not-included', severity: 'warn', message: `Falta seção 'O que não está neste PRD'` });
  }

  // Tasks fields
  for (const phase of prd.phases) {
    for (const epic of phase.epics) {
      for (const task of epic.tasks) {
        if (!task.size) {
          push({
            checkId: 'task-missing-size',
            severity: 'warn',
            line: task.startLine + 1,
            message: `Task ${task.id} (${task.title}) sem **Tamanho**`,
          });
        }
        if (!task.priority) {
          push({
            checkId: 'task-missing-priority',
            severity: 'warn',
            line: task.startLine + 1,
            message: `Task ${task.id} (${task.title}) sem **Prioridade**`,
          });
        }
        if (task.acceptanceCriteria.length === 0) {
          push({
            checkId: 'task-missing-ac',
            severity: 'error',
            line: task.startLine + 1,
            message: `Task ${task.id} (${task.title}) sem **Critérios de aceite**`,
          });
        }
        // AC vagos
        for (const ac of task.acceptanceCriteria) {
          const lower = ac.toLowerCase();
          const isGwt = /\bGIVEN\b/i.test(ac) || /\b\[\s*\]/.test(ac) || /^[-*]?\s*\[/.test(ac);
          const hasVagueWord = /\b(works|works correctly|funciona|funciona corretamente|ok|fine|good)\b/i.test(lower);
          if (!isGwt && hasVagueWord) {
            push({
              checkId: 'ac-vague',
              severity: 'warn',
              line: task.startLine + 1,
              message: `Task ${task.id} AC vago: "${ac.slice(0, 80)}${ac.length > 80 ? '…' : ''}"`,
            });
          }
        }
        // Task deps internas — suporta ranges (1.1-1.4) e múltiplos refs
        if (task.dependsOn) {
          const allTaskIds = new Set(
            prd.phases.flatMap((p) => p.epics.flatMap((e) => e.tasks.map((t) => t.id)))
          );
          for (const depRaw of task.dependsOn) {
            // Se menciona outro PRD/file/external, pula check interno
            if (/PRD|irmão|`[a-z-]+\.md`|external|external|\.md\b/i.test(depRaw)) continue;
            const allRefs: string[] = [];
            for (const m of depRaw.matchAll(/Task\s+(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)/gi)) {
              const raw = m[1].replace(/[,.;:)]+$/, '');
              const rangeM = raw.match(/^(\d+)\.(\d+)-(\d+)\.(\d+)$/);
              if (rangeM) {
                const [, p1, t1, p2, t2] = rangeM;
                if (p1 === p2) {
                  for (let i = +t1; i <= +t2; i++) allRefs.push(`${p1}.${i}`);
                } else allRefs.push(raw);
              } else {
                allRefs.push(raw);
              }
            }
            for (const refId of allRefs) {
              if (!allTaskIds.has(refId)) {
                push({
                  checkId: 'task-dep-broken',
                  severity: 'error',
                  line: task.startLine + 1,
                  message: `Task ${task.id} depende de Task ${refId} que não existe neste PRD`,
                });
              }
            }
          }
        }
      }
    }
  }

  // Cross-ref broken — só conta se contexto sugere que era PRD (não regra/skill/etc)
  // Lista de arquivos .md conhecidos que NÃO são PRDs
  const knownNonPrd = new Set([
    'web.md', 'api.md', 'mcp.md', 'cli.md', 'core.md', 'schemas.md', 'tests.md',
    'typescript.md', 'karpathy.md', 'anti-hallucination.md', 'browser-pilot.md',
    'browser-harness.md', 'dod-task-quality.md', 'CLAUDE.md', 'README.md',
    'SKILL.md', 'memory.md', 'MEMORY.md',
  ]);
  for (const m of prd.rawContent.matchAll(/`([a-z][a-z0-9-]*\.md)`/gi)) {
    const ref = m[1];
    if (allPrdNames.has(ref) || ref === prd.fileName) continue;
    if (knownNonPrd.has(ref)) continue;
    if (knownNonPrd.has(ref.toLowerCase())) continue;
    // se contexto antes da ref menciona "regra", "skill", "rules/", pula
    const idx = prd.rawContent.indexOf('`' + ref + '`');
    const ctxBefore = prd.rawContent.slice(Math.max(0, idx - 100), idx).toLowerCase();
    if (/regra|rule|skill|\.claude\//.test(ctxBefore)) continue;
    push({
      checkId: 'cross-ref-broken',
      severity: 'error',
      message: `Referência a '${ref}' não existe em docs/prd/`,
    });
  }

  // Forbidden phrases
  const lines = prd.rawLines;
  for (let i = 0; i < lines.length; i++) {
    for (const { phrase, suggestion } of FORBIDDEN_PHRASES) {
      const found = lines[i].match(phrase);
      if (found) {
        // skip refutação header (rubber-duck) que pode mencionar como exemplo
        const ctx = lines.slice(Math.max(0, i - 5), i).join(' ');
        if (/rubber-duck|refutaç|forbidden/i.test(ctx)) continue;
        push({
          checkId: 'forbidden-phrase',
          severity: 'warn',
          line: i + 1,
          message: `Phrase proibida "${found[0]}" — ${suggestion}`,
        });
      }
    }
  }

  return issues;
}

// ============================================================================
// FS AUDIT (Critical Files)
// ============================================================================

// Cache: lista de todos arquivos source do projeto (lazy build)
let PROJECT_FILES_CACHE: string[] | null = null;
function loadProjectFiles(): string[] {
  if (PROJECT_FILES_CACHE) return PROJECT_FILES_CACHE;
  const out: string[] = [];
  const skipDirs = new Set(['node_modules', 'dist', '.git', 'coverage', 'workflow-graph', 'vendor', '.mcp-graph-backups']);
  function walk(dir: string, rel: string): void {
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      if (skipDirs.has(e)) continue;
      if (e.startsWith('.') && !['.claude', '.github'].includes(e)) continue;
      const full = path.join(dir, e);
      const r = rel ? `${rel}/${e}` : e;
      let stat;
      try { stat = require('node:fs').statSync(full); } catch { continue; }
      if (stat.isDirectory()) walk(full, r);
      else out.push(r);
    }
  }
  walk(PROJECT_ROOT, '');
  PROJECT_FILES_CACHE = out;
  return out;
}

function auditCriticalFiles(prd: Prd): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const push = (ci: Omit<CheckIssue, 'prdFile'>) => issues.push({ ...ci, prdFile: prd.fileName });
  const allFiles = loadProjectFiles();

  for (const p of prd.criticalFiles.create) {
    const isWildcard = p.includes('*') || p.includes('{') || p.endsWith('/');
    if (isWildcard) continue;
    const abs = path.join(PROJECT_ROOT, p);
    if (existsSync(abs)) {
      push({
        checkId: 'critical-file-create-exists',
        severity: 'warn',
        message: `'Criar: ${p}' mas arquivo já existe no FS`,
      });
    }
  }

  for (const p of prd.criticalFiles.modify) {
    const isWildcard = p.includes('*') || p.includes('{') || p.endsWith('/');
    if (isWildcard) continue;
    if (!p.includes('/')) continue;
    const abs = path.join(PROJECT_ROOT, p);
    if (existsSync(abs)) continue;
    // tenta variações case-insensitive (ex: app.tsx → App.tsx)
    const dir = path.dirname(abs);
    const base = path.basename(abs);
    if (existsSync(dir)) {
      try {
        const entries = require('node:fs').readdirSync(dir);
        const ciMatch = entries.find((e: string) => e.toLowerCase() === base.toLowerCase());
        if (ciMatch) {
          if (ciMatch !== base) {
            push({
              checkId: 'critical-file-modify-case-mismatch',
              severity: 'warn',
              message: `'Modificar: ${p}' — arquivo existe como '${path.relative(PROJECT_ROOT, path.join(dir, ciMatch))}' (case difere)`,
            });
          }
          continue;
        }
      } catch {}
    }
    // Procura hint "(criado pelo PRD)" ou similar perto do path no source — downgrade pra warn
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ctxRegex = new RegExp(`${escaped}[^\\n]*?\\b(criado pelo|created by|delivered by|pré-?requisito)\\b`, 'i');
    const downgrade = ctxRegex.test(prd.bodyWithoutEnricher);
    const suggestions = suggestNearestPath(p, allFiles, 10);
    const hint = suggestions.length > 0 ? ` — did you mean: ${suggestions.map((s) => `'${s}'`).join(', ')}?` : '';
    push({
      checkId: downgrade ? 'critical-file-modify-deferred' : 'critical-file-modify-missing',
      severity: downgrade ? 'warn' : 'error',
      message: downgrade
        ? `'Modificar: ${p}' — arquivo será criado por PRD irmão (deferred dep)`
        : `'Modificar: ${p}' mas arquivo não existe no FS${hint}`,
    });
  }

  for (const p of prd.criticalFiles.delete) {
    const isWildcard = p.includes('*') || p.includes('{') || p.endsWith('/');
    if (isWildcard) continue;
    if (!p.includes('/')) continue;
    const abs = path.join(PROJECT_ROOT, p);
    if (!existsSync(abs)) {
      push({
        checkId: 'critical-file-delete-missing',
        severity: 'warn',
        message: `'Deletar: ${p}' mas arquivo já não existe`,
      });
    }
  }

  for (const r of prd.criticalFiles.rename) {
    const absFrom = path.join(PROJECT_ROOT, r.from);
    if (!existsSync(absFrom)) {
      push({
        checkId: 'critical-file-rename-source-missing',
        severity: 'error',
        message: `'Renomear: ${r.from} → ${r.to}' mas origem não existe`,
      });
    }
  }

  return issues;
}

// ============================================================================
// CROSS-REF MAP + ASYMMETRIC DEPS
// ============================================================================

function buildCrossRefMap(prds: Prd[]): Map<string, { references: string[]; referencedBy: string[] }> {
  const map = new Map<string, { references: string[]; referencedBy: string[] }>();
  for (const p of prds) {
    map.set(p.fileName, { references: [...p.crossRefs], referencedBy: [] });
  }
  for (const p of prds) {
    for (const ref of p.crossRefs) {
      const entry = map.get(ref);
      if (entry) entry.referencedBy.push(p.fileName);
    }
  }
  return map;
}

function checkAsymmetricDependencies(
  prds: Prd[],
  crossRefMap: ReturnType<typeof buildCrossRefMap>
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const p of prds) {
    // se P diz "depende de" Q, Q deveria ao menos referenciar P em cross-refs
    const dependsRegex = /depend(?:e|s)\s+(?:de|on)\s+`([a-z0-9-]+\.md)`/gi;
    for (const m of p.rawContent.matchAll(dependsRegex)) {
      const target = m[1];
      const targetEntry = crossRefMap.get(target);
      if (!targetEntry) continue;
      if (!targetEntry.referencedBy.includes(p.fileName)) {
        // P depende de Q mas Q não menciona P em lugar algum — assimetria
        // Esse check é warn porque dependência pode ser one-way legitimamente
        issues.push({
          checkId: 'dependency-asymmetric',
          severity: 'info',
          prdFile: p.fileName,
          message: `Declara dependência de ${target}, mas ${target} não referencia este PRD`,
        });
      }
    }
  }
  return issues;
}

// ============================================================================
// ENRICHMENT BLOCK
// ============================================================================

function generateEnrichmentBlock(
  prd: Prd,
  issues: CheckIssue[],
  crossRefMap: ReturnType<typeof buildCrossRefMap>
): string {
  const entry = crossRefMap.get(prd.fileName) ?? { references: [], referencedBy: [] };

  const counts = {
    error: issues.filter((i) => i.severity === 'error').length,
    warn: issues.filter((i) => i.severity === 'warn').length,
    info: issues.filter((i) => i.severity === 'info').length,
  };

  const totalTasks = prd.phases.flatMap((p) => p.epics.flatMap((e) => e.tasks)).length;
  const completeTasks = prd.phases.flatMap((p) => p.epics.flatMap((e) => e.tasks))
    .filter((t) => t.size && t.priority && t.acceptanceCriteria.length > 0).length;

  const lines: string[] = [];
  lines.push(ENRICHER_START);
  lines.push('');
  lines.push('## 🤖 Enrichment Report (auto-generated, regenerable via `npx tsx scripts/prd-enricher.ts enrich --apply`)');
  lines.push('');
  lines.push(`**Issues:** ${counts.error} error, ${counts.warn} warn, ${counts.info} info`);
  lines.push(`**Tasks completas (size+prio+ac):** ${completeTasks}/${totalTasks}`);
  lines.push('');

  // Cross-refs
  if (entry.references.length || entry.referencedBy.length) {
    lines.push('### Cross-PRD Index');
    lines.push('');
    if (entry.references.length) {
      lines.push(`**Referencia:** ${entry.references.map((r) => `\`${r}\``).join(', ')}`);
    }
    if (entry.referencedBy.length) {
      lines.push(`**Referenciado por:** ${entry.referencedBy.map((r) => `\`${r}\``).join(', ')}`);
    }
    lines.push('');
  }

  // Issues por categoria
  if (issues.length > 0) {
    const byCheck = new Map<string, CheckIssue[]>();
    for (const i of issues) {
      const arr = byCheck.get(i.checkId) ?? [];
      arr.push(i);
      byCheck.set(i.checkId, arr);
    }
    lines.push('### Issues encontradas');
    lines.push('');
    const sorted = [...byCheck.entries()].sort((a, b) => {
      const sevOrder: Record<string, number> = { error: 0, warn: 1, info: 2 };
      const sa = sevOrder[a[1][0].severity];
      const sb = sevOrder[b[1][0].severity];
      return sa - sb;
    });
    for (const [checkId, items] of sorted) {
      lines.push(`#### \`${checkId}\` (${items[0].severity}) × ${items.length}`);
      for (const it of items.slice(0, 5)) {
        lines.push(`- ${it.line ? `L${it.line}: ` : ''}${it.message}`);
      }
      if (items.length > 5) lines.push(`- ... e mais ${items.length - 5}`);
      lines.push('');
    }
  } else {
    lines.push('### ✓ Sem issues detectadas');
    lines.push('');
  }

  lines.push(ENRICHER_END);
  return lines.join('\n');
}

function applyEnrichment(prd: Prd, block: string): string {
  // Insere após primeiro H1 + linha em branco
  const content = prd.bodyWithoutEnricher;
  const lines = content.split('\n');
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^#\s+/.test(lines[i])) {
      insertAt = i + 1;
      // pula linha em branco se houver
      if (lines[i + 1]?.trim() === '') insertAt = i + 2;
      break;
    }
  }
  return [...lines.slice(0, insertAt), '', block, '', ...lines.slice(insertAt)].join('\n');
}

// ============================================================================
// REPORT RENDERER
// ============================================================================

interface MethodologyOutputs {
  invest: Map<string, { taskId: string; title: string; score: InvestScore }[]>; // por PRD
  ieee830: Map<string, Ieee830Score>;
  cycles: string[][];
  topoOrder: string[];
  topoRemaining: string[];
  cpmPath: string[];
  cpmLength: number;
  hubInDegree: Map<string, number>;
  topPriorityFixes: { prd: string; checkId: string; severity: string; impact: string; count: number }[];
}

function computeMethodologies(
  prds: Prd[],
  allIssues: Map<string, CheckIssue[]>,
  crossRefMap: ReturnType<typeof buildCrossRefMap>
): MethodologyOutputs {
  const invest = new Map<string, { taskId: string; title: string; score: InvestScore }[]>();
  const ieee830 = new Map<string, Ieee830Score>();

  const nodes = prds.map((p) => p.fileName);
  // SEMANTIC GRAPH (todas referências) — usado para hubs/centrality
  const semanticEdges = new Map<string, string[]>();
  for (const p of prds) semanticEdges.set(p.fileName, p.crossRefs);
  // HARD DEPENDENCY GRAPH — só refs com palavra "depende de", "pré-requisito", "bloqueado por"
  // Refutação interna: Tarjan/Kahn/CPM rodam sobre deps, não sobre menções.
  const hardEdges = new Map<string, string[]>();
  for (const p of prds) hardEdges.set(p.fileName, []);
  const nodeSet = new Set(nodes);
  for (const p of prds) {
    const re = /(?:depende?\s+(?:de|on)|pr[ée]-?requisito|bloqueado\s+por|requires?|blocked\s+by|after\s+the\s+PRD)\s*[:\s]?\s*`([a-z][a-z0-9-]+\.md)`/gi;
    const seen = new Set<string>();
    for (const m of p.bodyWithoutEnricher.matchAll(re)) {
      const target = m[1];
      if (nodeSet.has(target) && !seen.has(target)) {
        seen.add(target);
        hardEdges.get(p.fileName)?.push(target);
      }
    }
  }

  for (const prd of prds) {
    // INVEST por task
    const scores: { taskId: string; title: string; score: InvestScore }[] = [];
    for (const phase of prd.phases) {
      for (const epic of phase.epics) {
        for (const task of epic.tasks) {
          scores.push({
            taskId: task.id,
            title: task.title,
            score: scoreInvest({
              id: task.id,
              title: task.title,
              size: task.size,
              acceptanceCriteria: task.acceptanceCriteria,
              dependsOn: task.dependsOn,
              body: task.body,
            }),
          });
        }
      }
    }
    invest.set(prd.fileName, scores);

    // IEEE830 por PRD
    const totalTasks = prd.phases.flatMap((p) => p.epics.flatMap((e) => e.tasks)).length;
    const tasksWithPriority = prd.phases.flatMap((p) => p.epics.flatMap((e) => e.tasks)).filter((t) => t.priority).length;
    const issues = allIssues.get(prd.fileName) ?? [];
    const brokenCrossRefs = issues.filter((i) => i.checkId === 'cross-ref-broken').length;
    const entry = crossRefMap.get(prd.fileName)!;
    ieee830.set(
      prd.fileName,
      scoreIeee830({
        fileName: prd.fileName,
        sectionsPresent: new Set(prd.sections.keys()),
        totalTasks,
        tasksWithPriority,
        crossRefs: entry.references,
        referencedBy: entry.referencedBy,
        brokenCrossRefs,
      })
    );
  }

  // Tarjan: ciclos — só sobre HARD deps (mention ≠ dependency)
  const scc = tarjanScc(nodes, hardEdges);

  // Kahn: ordem topológica — só sobre HARD deps
  const topo = kahnTopologicalSort(nodes, hardEdges);

  // CPM: caminho crítico (peso = número de tasks do PRD) — sobre HARD deps
  const taskCountByPrd = new Map<string, number>();
  for (const prd of prds) {
    taskCountByPrd.set(prd.fileName, prd.phases.flatMap((p) => p.epics.flatMap((e) => e.tasks)).length || 1);
  }
  const cpm = criticalPath(nodes, hardEdges, (n) => taskCountByPrd.get(n) ?? 1);

  // Centrality (in-degree) — sobre SEMANTIC graph (todas refs)
  const hubInDegree = inDegreeCentrality(nodes, semanticEdges);

  // Top priority fixes (rank por severity + count + se está no caminho crítico)
  const cpmSet = new Set(cpm.longestPath);
  const allIssuesFlat: { prd: string; checkId: string; severity: string }[] = [];
  for (const [prd, issues] of allIssues) {
    for (const i of issues) allIssuesFlat.push({ prd, checkId: i.checkId, severity: i.severity });
  }
  // agrupa
  const grouped = new Map<string, { prd: string; checkId: string; severity: string; count: number }>();
  for (const i of allIssuesFlat) {
    const key = `${i.prd}::${i.checkId}::${i.severity}`;
    const g = grouped.get(key) ?? { prd: i.prd, checkId: i.checkId, severity: i.severity, count: 0 };
    g.count++;
    grouped.set(key, g);
  }
  const ranked = [...grouped.values()]
    .map((g) => {
      const sevWeight = g.severity === 'error' ? 10 : g.severity === 'warn' ? 3 : 1;
      const cpmWeight = cpmSet.has(g.prd) ? 2 : 1;
      const score = sevWeight * cpmWeight * g.count;
      const impactReason: string[] = [];
      if (g.severity === 'error') impactReason.push('error');
      if (cpmSet.has(g.prd)) impactReason.push('caminho crítico');
      if (g.count >= 3) impactReason.push(`${g.count}x recorrente`);
      return { ...g, score, impact: impactReason.join(', ') };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  return {
    invest,
    ieee830,
    cycles: scc.cycles,
    topoOrder: topo.order,
    topoRemaining: topo.remaining,
    cpmPath: cpm.longestPath,
    cpmLength: cpm.longestPathLength,
    hubInDegree,
    topPriorityFixes: ranked.map((r) => ({ prd: r.prd, checkId: r.checkId, severity: r.severity, impact: r.impact, count: r.count })),
  };
}

function renderAuditReport(
  prds: Prd[],
  allIssues: Map<string, CheckIssue[]>,
  crossRefMap: ReturnType<typeof buildCrossRefMap>,
  methodology: MethodologyOutputs
): string {
  const lines: string[] = [];
  lines.push('# PRD Audit Report');
  lines.push('');
  lines.push(`Gerado em: ${new Date().toISOString()}`);
  lines.push(`PRDs analisados: ${prds.length}`);
  lines.push('');

  // Sumário global
  let totalErr = 0, totalWarn = 0, totalInfo = 0;
  for (const issues of allIssues.values()) {
    totalErr += issues.filter((i) => i.severity === 'error').length;
    totalWarn += issues.filter((i) => i.severity === 'warn').length;
    totalInfo += issues.filter((i) => i.severity === 'info').length;
  }
  lines.push('## Sumário global');
  lines.push('');
  lines.push(`- **Errors:** ${totalErr}`);
  lines.push(`- **Warnings:** ${totalWarn}`);
  lines.push(`- **Info:** ${totalInfo}`);
  lines.push('');

  // Top issue types
  lines.push('## Issues por categoria (todas PRDs)');
  lines.push('');
  const byCheck = new Map<string, CheckIssue[]>();
  for (const issues of allIssues.values()) {
    for (const i of issues) {
      const arr = byCheck.get(i.checkId) ?? [];
      arr.push(i);
      byCheck.set(i.checkId, arr);
    }
  }
  const sorted = [...byCheck.entries()].sort((a, b) => b[1].length - a[1].length);
  lines.push('| Check ID | Severity | Count |');
  lines.push('|---|---|---:|');
  for (const [id, items] of sorted) {
    lines.push(`| \`${id}\` | ${items[0].severity} | ${items.length} |`);
  }
  lines.push('');

  // Cross-ref graph
  lines.push('## Cross-Reference Graph');
  lines.push('');
  lines.push('| PRD | Referencia | Referenciado por |');
  lines.push('|---|---|---|');
  for (const prd of prds) {
    const e = crossRefMap.get(prd.fileName)!;
    lines.push(
      `| \`${prd.fileName}\` | ${e.references.length ? e.references.map((r) => `\`${r}\``).join(', ') : '—'} | ${
        e.referencedBy.length ? e.referencedBy.map((r) => `\`${r}\``).join(', ') : '—'
      } |`
    );
  }
  lines.push('');

  // ===== METODOLOGIAS =====
  lines.push('## Metodologias aplicadas');
  lines.push('');

  // Tarjan: ciclos
  lines.push('### Tarjan SCC — Ciclos no grafo de cross-refs');
  lines.push('');
  if (methodology.cycles.length === 0) {
    lines.push('✓ Nenhum ciclo detectado.');
  } else {
    lines.push('⚠ Ciclos detectados:');
    for (const c of methodology.cycles) {
      lines.push(`- ${c.map((n) => `\`${n}\``).join(' → ')} → \`${c[0]}\``);
    }
  }
  lines.push('');

  // Kahn: ordem topológica
  lines.push('### Kahn — Ordem topológica recomendada (Wave assignment)');
  lines.push('');
  if (methodology.topoRemaining.length > 0) {
    lines.push(`⚠ ${methodology.topoRemaining.length} PRDs ficaram fora da ordem (parte de ciclos): ${methodology.topoRemaining.map((n) => `\`${n}\``).join(', ')}`);
    lines.push('');
  }
  for (let i = 0; i < methodology.topoOrder.length; i++) {
    lines.push(`${i + 1}. \`${methodology.topoOrder[i]}\``);
  }
  lines.push('');

  // CPM
  lines.push('### Critical Path Method — Caminho crítico (peso = nº tasks)');
  lines.push('');
  lines.push(`Caminho mais longo: ${methodology.cpmLength} tasks acumuladas`);
  lines.push('');
  if (methodology.cpmPath.length > 0) {
    lines.push('```');
    lines.push(methodology.cpmPath.join(' → '));
    lines.push('```');
  }
  lines.push('');

  // Hubs
  lines.push('### Hub centrality — In-degree (PRDs mais referenciados)');
  lines.push('');
  const sortedHubs = [...methodology.hubInDegree.entries()]
    .filter(([, d]) => d > 0)
    .sort((a, b) => b[1] - a[1]);
  lines.push('| PRD | In-degree |');
  lines.push('|---|---:|');
  for (const [n, d] of sortedHubs) {
    lines.push(`| \`${n}\` | ${d} |`);
  }
  lines.push('');

  // IEEE 830
  lines.push('### IEEE 830 — Quality scores (complete / consistent / ranked / traceable)');
  lines.push('');
  lines.push('| PRD | Complete | Consistent | Ranked | Traceable |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const prd of prds) {
    const s = methodology.ieee830.get(prd.fileName)!;
    lines.push(
      `| \`${prd.fileName}\` | ${(s.complete.score * 100).toFixed(0)}% | ${(s.consistent.score * 100).toFixed(0)}% | ${(s.ranked.score * 100).toFixed(0)}% | ${(s.traceable.score * 100).toFixed(0)}% |`
    );
  }
  lines.push('');

  // INVEST aggregated
  lines.push('### INVEST — Score médio por PRD (0-6)');
  lines.push('');
  lines.push('| PRD | Tasks | INVEST avg | Top weak trait |');
  lines.push('|---|---:|---:|---|');
  for (const prd of prds) {
    const scores = methodology.invest.get(prd.fileName) ?? [];
    if (scores.length === 0) {
      lines.push(`| \`${prd.fileName}\` | 0 | — | — |`);
      continue;
    }
    const avg = scores.reduce((a, s) => a + s.score.total, 0) / scores.length;
    // qual trait falha mais?
    const traitFails: Record<string, number> = {
      independent: 0, negotiable: 0, valuable: 0, estimable: 0, small: 0, testable: 0,
    };
    for (const s of scores) {
      for (const [k, v] of Object.entries(s.score.breakdown)) {
        if (!v) traitFails[k]++;
      }
    }
    const weakest = Object.entries(traitFails).sort((a, b) => b[1] - a[1])[0];
    lines.push(`| \`${prd.fileName}\` | ${scores.length} | ${avg.toFixed(2)} | ${weakest[1] > 0 ? `${weakest[0]} (${weakest[1]} fails)` : '—'} |`);
  }
  lines.push('');

  // Top priority fixes
  lines.push('### 🔥 Top priority fixes (severity × CPM × frequência)');
  lines.push('');
  lines.push('Score = severity_weight × cpm_multiplier × count');
  lines.push('');
  lines.push('| Rank | PRD | Check | Severity | Count | Impact |');
  lines.push('|---:|---|---|---|---:|---|');
  for (let i = 0; i < methodology.topPriorityFixes.length; i++) {
    const f = methodology.topPriorityFixes[i];
    lines.push(`| ${i + 1} | \`${f.prd}\` | \`${f.checkId}\` | ${f.severity} | ${f.count} | ${f.impact} |`);
  }
  lines.push('');

  // Per-PRD detail
  lines.push('## Detalhe por PRD');
  lines.push('');
  for (const prd of prds) {
    const issues = allIssues.get(prd.fileName) ?? [];
    const counts = {
      error: issues.filter((i) => i.severity === 'error').length,
      warn: issues.filter((i) => i.severity === 'warn').length,
      info: issues.filter((i) => i.severity === 'info').length,
    };
    const totalTasks = prd.phases.flatMap((p) => p.epics.flatMap((e) => e.tasks)).length;
    const completeTasks = prd.phases.flatMap((p) => p.epics.flatMap((e) => e.tasks))
      .filter((t) => t.size && t.priority && t.acceptanceCriteria.length > 0).length;

    lines.push(`### \`${prd.fileName}\``);
    lines.push('');
    lines.push(`- Title: ${prd.title}`);
    lines.push(`- Phases: ${prd.phases.length} | Tasks: ${totalTasks} (${completeTasks} completas)`);
    lines.push(`- Issues: ${counts.error} error, ${counts.warn} warn, ${counts.info} info`);
    lines.push('');

    if (issues.length > 0) {
      const byCheckPrd = new Map<string, CheckIssue[]>();
      for (const i of issues) {
        const arr = byCheckPrd.get(i.checkId) ?? [];
        arr.push(i);
        byCheckPrd.set(i.checkId, arr);
      }
      const sortedPrd = [...byCheckPrd.entries()].sort((a, b) => {
        const sevOrder: Record<string, number> = { error: 0, warn: 1, info: 2 };
        return sevOrder[a[1][0].severity] - sevOrder[b[1][0].severity];
      });
      for (const [id, items] of sortedPrd) {
        lines.push(`<details><summary><code>${id}</code> (${items[0].severity}) × ${items.length}</summary>`);
        lines.push('');
        for (const it of items.slice(0, 10)) {
          lines.push(`- ${it.line ? `L${it.line}: ` : ''}${it.message}`);
        }
        if (items.length > 10) lines.push(`- ... e mais ${items.length - 10}`);
        lines.push('');
        lines.push('</details>');
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'audit';
  const flags = new Set(args.slice(1));
  const excludeOldPrds = flags.has('--exclude-old');

  await loadForbiddenPhrases();

  // Coleta PRDs
  const allFiles = await fs.readdir(PRD_DIR);
  let mdFiles = allFiles.filter((f) => f.endsWith('.md')).sort();
  if (excludeOldPrds) {
    mdFiles = mdFiles.filter((f) => !/^prd-(9-concepts|mcp-graph-bug-fixes)/.test(f));
  }
  const allPrdNames = new Set(mdFiles);

  const prds: Prd[] = [];
  for (const f of mdFiles) {
    const prd = await parsePrd(path.join(PRD_DIR, f));
    prd.crossRefs = extractCrossRefs(prd.bodyWithoutEnricher, allPrdNames).filter((r) => r !== f);
    prds.push(prd);
  }

  const prdMap = new Map(prds.map((p) => [p.fileName, p]));
  const crossRefMap = buildCrossRefMap(prds);

  // Run checks
  const allIssues = new Map<string, CheckIssue[]>();
  for (const prd of prds) {
    const checks = runChecks(prd, allPrdNames, prdMap);
    const fsIssues = auditCriticalFiles(prd);
    allIssues.set(prd.fileName, [...checks, ...fsIssues]);
  }
  // Cross-PRD asymmetric deps
  const asymmetric = checkAsymmetricDependencies(prds, crossRefMap);
  for (const i of asymmetric) {
    const arr = allIssues.get(i.prdFile) ?? [];
    arr.push(i);
    allIssues.set(i.prdFile, arr);
  }

  // Compute methodology outputs (uma vez, reusado por audit/enrich)
  const methodology = computeMethodologies(prds, allIssues, crossRefMap);

  // Mode dispatch
  if (mode === 'audit') {
    await fs.mkdir(path.dirname(AUDIT_OUT), { recursive: true });
    const report = renderAuditReport(prds, allIssues, crossRefMap, methodology);
    await fs.writeFile(AUDIT_OUT, report);
    let totalErr = 0, totalWarn = 0, totalInfo = 0;
    for (const issues of allIssues.values()) {
      totalErr += issues.filter((i) => i.severity === 'error').length;
      totalWarn += issues.filter((i) => i.severity === 'warn').length;
      totalInfo += issues.filter((i) => i.severity === 'info').length;
    }
    console.log(`✓ Audit written to ${path.relative(PROJECT_ROOT, AUDIT_OUT)}`);
    console.log(`  PRDs: ${prds.length}`);
    console.log(`  Issues: ${totalErr} error, ${totalWarn} warn, ${totalInfo} info`);
  } else if (mode === 'enrich') {
    const dryRun = !flags.has('--apply');
    let written = 0;
    for (const prd of prds) {
      const issues = allIssues.get(prd.fileName) ?? [];
      const block = generateEnrichmentBlock(prd, issues, crossRefMap);
      if (dryRun) {
        console.log(`\n=== ${prd.fileName} ===`);
        console.log(block);
      } else {
        const newContent = applyEnrichment(prd, block);
        await fs.writeFile(prd.filePath, newContent);
        written++;
      }
    }
    if (!dryRun) console.log(`✓ Enriched ${written} PRDs`);
    else console.log(`(dry-run; use --apply para escrever)`);
  } else if (mode === 'validate') {
    let errCount = 0;
    for (const issues of allIssues.values()) {
      errCount += issues.filter((i) => i.severity === 'error').length;
    }
    if (flags.has('--strict') && errCount > 0) {
      console.error(`✗ ${errCount} errors found`);
      process.exit(1);
    }
    console.log(`✓ ${errCount} errors`);
  } else if (mode === 'clean') {
    let cleaned = 0;
    for (const prd of prds) {
      if (prd.rawContent.includes(ENRICHER_START)) {
        await fs.writeFile(prd.filePath, prd.bodyWithoutEnricher);
        cleaned++;
      }
    }
    console.log(`✓ Cleaned ${cleaned} PRDs`);
  } else {
    console.error(`Unknown mode: ${mode}`);
    console.error(`Usage: prd-enricher.ts <audit|enrich [--dry-run|--apply]|validate [--strict]|clean>`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
