/**
 * Metodologias formais aplicadas ao audit/enrichment de PRDs.
 *
 * Cada função é PURA, testável, e cita a fonte da metodologia.
 * Sem LLM, sem ML — só algoritmos clássicos.
 */

// ============================================================================
// INVEST scoring (Bill Wake, 2003 — Extreme Programming Explored)
// Independent, Negotiable, Valuable, Estimable, Small, Testable
// Aplicado por TASK. Score 0-6.
// ============================================================================

export interface InvestScore {
  total: number;
  breakdown: {
    independent: boolean;
    negotiable: boolean;
    valuable: boolean;
    estimable: boolean;
    small: boolean;
    testable: boolean;
  };
  reasons: string[];
}

export interface TaskForInvest {
  id: string;
  title: string;
  size?: string;
  acceptanceCriteria: string[];
  dependsOn?: string[];
  body: string;
}

export function scoreInvest(task: TaskForInvest): InvestScore {
  const reasons: string[] = [];

  // Independent: task sem deps OU com deps explícitas pequenas (<3)
  const independent = !task.dependsOn || task.dependsOn.length <= 2;
  if (!independent) reasons.push(`${task.dependsOn!.length} deps (>2) reduz independência`);

  // Negotiable: corpo NÃO é só lista de tecnicalidades fixas (heurística: tem prosa fora de bullets)
  const proseLines = task.body.split('\n').filter((l) => {
    const t = l.trim();
    return t.length > 20 && !t.startsWith('-') && !t.startsWith('*') && !t.startsWith('#') && !t.startsWith('**');
  });
  const negotiable = proseLines.length >= 1;
  if (!negotiable) reasons.push('só bullets/headers, sem prosa explicativa (over-specified)');

  // Valuable: título começa com verbo de ação (heurística PT/EN)
  const actionVerbs = /^(criar|implementar|adicionar|remover|migrar|refatorar|deletar|renomear|expor|integrar|validar|persistir|gerar|escrever|reescrever|atualizar|mover|extrair|create|implement|add|remove|migrate|refactor|delete|rename|expose|integrate|validate|persist|generate|write|update|move|extract|build|ship|deliver)/i;
  const valuable = actionVerbs.test(task.title);
  if (!valuable) reasons.push(`título não começa com verbo de ação`);

  // Estimable: tem size definido
  const estimable = !!task.size;
  if (!estimable) reasons.push('sem **Tamanho**');

  // Small: size ≤ M
  const small = task.size === 'XS' || task.size === 'S' || task.size === 'M';
  if (!small && task.size) reasons.push(`size=${task.size} (>M)`);

  // Testable: tem ≥1 AC + AC contém critério mensurável (GWT, número, comparação)
  const hasAc = task.acceptanceCriteria.length > 0;
  const measurableAc = task.acceptanceCriteria.some(
    (ac) => /\bGIVEN\b|\bWHEN\b|\bTHEN\b|\d|<|>|=|≤|≥/i.test(ac)
  );
  const testable = hasAc && measurableAc;
  if (!testable) reasons.push('AC sem critério mensurável (sem GWT, números ou comparações)');

  const breakdown = { independent, negotiable, valuable, estimable, small, testable };
  const total = Object.values(breakdown).filter(Boolean).length;

  return { total, breakdown, reasons };
}

// ============================================================================
// Tarjan SCC (Tarjan, 1972 — DFS-based strongly connected components)
// Detecta ciclos no grafo de dependências entre PRDs.
// ============================================================================

export interface ScCResult {
  components: string[][]; // cada componente é lista de nós
  cycles: string[][]; // só componentes com >1 nó OU self-loop
}

export function tarjanScc(nodes: string[], edges: Map<string, string[]>): ScCResult {
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const components: string[][] = [];

  function strongconnect(v: string): void {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    const neighbors = edges.get(v) ?? [];
    for (const w of neighbors) {
      if (!indices.has(w)) {
        strongconnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      components.push(component);
    }
  }

  for (const v of nodes) {
    if (!indices.has(v)) strongconnect(v);
  }

  const cycles = components.filter((c) => {
    if (c.length > 1) return true;
    // self-loop?
    return edges.get(c[0])?.includes(c[0]) ?? false;
  });

  return { components, cycles };
}

// ============================================================================
// Kahn's topological sort (Kahn, 1962)
// Ordena nós respeitando dependências. Falha se há ciclo.
// ============================================================================

export interface TopoResult {
  order: string[]; // ordem topológica (deps primeiro)
  hasCycle: boolean;
  remaining: string[]; // nós que sobraram (faziam parte de ciclos)
}

export function kahnTopologicalSort(nodes: string[], edges: Map<string, string[]>): TopoResult {
  // edges: nó → nós dos quais depende (prerequisitos)
  // queremos ordem onde prerequisitos vêm primeiro
  const inDegree = new Map<string, number>();
  const reversedEdges = new Map<string, string[]>(); // de → consumidores

  for (const n of nodes) {
    inDegree.set(n, 0);
    reversedEdges.set(n, []);
  }
  for (const [node, deps] of edges) {
    for (const dep of deps) {
      if (!inDegree.has(dep)) continue;
      inDegree.set(node, (inDegree.get(node) ?? 0) + 1);
      reversedEdges.get(dep)!.push(node);
    }
  }

  const queue: string[] = [];
  for (const [node, deg] of inDegree) {
    if (deg === 0) queue.push(node);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const n = queue.shift()!;
    order.push(n);
    for (const consumer of reversedEdges.get(n) ?? []) {
      const newDeg = (inDegree.get(consumer) ?? 0) - 1;
      inDegree.set(consumer, newDeg);
      if (newDeg === 0) queue.push(consumer);
    }
  }

  const remaining = nodes.filter((n) => !order.includes(n));
  return { order, hasCycle: remaining.length > 0, remaining };
}

// ============================================================================
// Critical Path Method (Kelley & Walker, 1957 — DuPont/Remington Rand)
// Caminho mais longo no DAG = duração mínima do projeto inteiro.
// ============================================================================

export interface CpmResult {
  longestPath: string[];
  longestPathLength: number;
  pathLengthByNode: Map<string, number>;
}

export function criticalPath(
  nodes: string[],
  edges: Map<string, string[]>,
  weightFn: (node: string) => number
): CpmResult {
  // edges: nó → deps. Reverte: nó → consumidores.
  const consumers = new Map<string, string[]>();
  for (const n of nodes) consumers.set(n, []);
  for (const [node, deps] of edges) {
    for (const dep of deps) {
      consumers.get(dep)?.push(node);
    }
  }

  const topo = kahnTopologicalSort(nodes, edges);
  if (topo.hasCycle) {
    return { longestPath: [], longestPathLength: 0, pathLengthByNode: new Map() };
  }

  const length = new Map<string, number>();
  const predecessor = new Map<string, string | null>();
  for (const n of topo.order) {
    length.set(n, weightFn(n));
    predecessor.set(n, null);
  }

  for (const n of topo.order) {
    const myLen = length.get(n)!;
    for (const c of consumers.get(n) ?? []) {
      const proposed = myLen + weightFn(c);
      if (proposed > (length.get(c) ?? 0)) {
        length.set(c, proposed);
        predecessor.set(c, n);
      }
    }
  }

  // encontra terminal com maior length
  let endNode: string | null = null;
  let maxLen = -Infinity;
  for (const [n, l] of length) {
    if (l > maxLen) {
      maxLen = l;
      endNode = n;
    }
  }

  // reconstrói caminho
  const path: string[] = [];
  let cur = endNode;
  while (cur) {
    path.unshift(cur);
    cur = predecessor.get(cur) ?? null;
  }

  return { longestPath: path, longestPathLength: maxLen, pathLengthByNode: length };
}

// ============================================================================
// Damerau-Levenshtein distance (Damerau, 1964 / Levenshtein, 1966)
// Distância editorial entre strings, com swap de caracteres adjacentes.
// Usado para sugerir "did you mean" em paths quebrados.
// ============================================================================

export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1); // transposition
      }
    }
  }

  return dp[m][n];
}

export function suggestNearestPath(
  brokenPath: string,
  candidatePaths: string[],
  maxDistance = 8
): string[] {
  // normaliza para comparar nomes de arquivo (path → última parte) + path completo
  const broken = brokenPath.toLowerCase();
  const brokenBase = brokenPath.split('/').pop()!.toLowerCase();
  const scored = candidatePaths
    .map((p) => {
      const base = p.split('/').pop()!.toLowerCase();
      const distFull = damerauLevenshtein(broken, p.toLowerCase());
      const distBase = damerauLevenshtein(brokenBase, base);
      // score combina distância no nome de arquivo (peso 2) + path inteiro (peso 1)
      return { path: p, score: distBase * 2 + distFull };
    })
    .filter((x) => x.score <= maxDistance)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((x) => x.path);
  return scored;
}

// ============================================================================
// Hub centrality (in-degree only — simplificação justificada de PageRank)
// Para 15 nós, in-degree captura o mesmo signal de hub que PageRank.
// ============================================================================

export function inDegreeCentrality(
  nodes: string[],
  edges: Map<string, string[]>
): Map<string, number> {
  const deg = new Map<string, number>();
  for (const n of nodes) deg.set(n, 0);
  for (const [, deps] of edges) {
    for (const dep of deps) {
      if (deg.has(dep)) deg.set(dep, deg.get(dep)! + 1);
    }
  }
  return deg;
}

// ============================================================================
// IEEE 830-1998 SRS characteristics (parcial — as 4 verificáveis estaticamente)
// IEEE Std 830-1998: Recommended Practice for Software Requirements Specifications.
// 8 traits: correct, unambiguous, complete, consistent, ranked, verifiable, modifiable, traceable.
// Verificáveis estaticamente: complete (sections), consistent (cross-refs), ranked (priority), traceable (links).
// ============================================================================

export interface Ieee830Score {
  complete: { score: number; missing: string[] };
  consistent: { score: number; issues: string[] };
  ranked: { score: number; tasksWithoutPriority: number; totalTasks: number };
  traceable: { score: number; orphanReason?: string };
}

export interface PrdForIeee {
  fileName: string;
  sectionsPresent: Set<string>;
  totalTasks: number;
  tasksWithPriority: number;
  crossRefs: string[];
  referencedBy: string[];
  brokenCrossRefs: number;
}

export function scoreIeee830(prd: PrdForIeee): Ieee830Score {
  const requiredSections = ['Context', 'Riscos', 'Restrições', 'Critical Files', 'Verification'];
  const missing = requiredSections.filter((s) => !prd.sectionsPresent.has(s));
  const complete = {
    score: (requiredSections.length - missing.length) / requiredSections.length,
    missing,
  };

  const consistent = {
    score: prd.brokenCrossRefs === 0 ? 1 : Math.max(0, 1 - prd.brokenCrossRefs * 0.2),
    issues: prd.brokenCrossRefs > 0 ? [`${prd.brokenCrossRefs} cross-refs quebradas`] : [],
  };

  const ranked = {
    score: prd.totalTasks > 0 ? prd.tasksWithPriority / prd.totalTasks : 0,
    tasksWithoutPriority: prd.totalTasks - prd.tasksWithPriority,
    totalTasks: prd.totalTasks,
  };

  // traceable: tem alguma conexão com outro PRD?
  const totalLinks = prd.crossRefs.length + prd.referencedBy.length;
  const traceable = {
    score: totalLinks > 0 ? 1 : 0,
    orphanReason: totalLinks === 0 ? 'PRD órfão — sem cross-refs nem referenciado por nada' : undefined,
  };

  return { complete, consistent, ranked, traceable };
}
