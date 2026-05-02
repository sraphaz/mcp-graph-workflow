/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §AgentMonitor — Live agent monitoring tab.
 *
 * Two-column layout matching the existing dark-slate dashboard theme.
 *   Left (1/3):  agent list with status pill, heartbeat ago, current task
 *   Right (2/3): selected agent's task detail, lifecycle phase, touched
 *                files (+ / - per file), and on-demand per-file diff
 *
 * Real-time via SSE: the list and the right pane both refresh on
 * agent:heartbeat / task:claimed / task:released / task:status:changed.
 */

import { useEffect, useMemo, useState } from "react";
import { useAgentActivity, type AgentActivity } from "@/hooks/use-agent-activity";
import {
  useAgentWork,
  useAgentEvents,
  fetchFileDiff,
  type AgentWorkChangedFile,
  type FileDiffPayload,
  type AgentEvent,
} from "@/hooks/use-agent-work";

const PHASE_BADGE_CLASS: Record<string, string> = {
  ANALYZE: "bg-blue-900/40 text-blue-300 border-blue-800",
  DESIGN: "bg-violet-900/40 text-violet-300 border-violet-800",
  PLAN: "bg-amber-900/40 text-amber-300 border-amber-800",
  IMPLEMENT: "bg-emerald-900/40 text-emerald-300 border-emerald-800",
  VALIDATE: "bg-cyan-900/40 text-cyan-300 border-cyan-800",
  REVIEW: "bg-indigo-900/40 text-indigo-300 border-indigo-800",
  HANDOFF: "bg-pink-900/40 text-pink-300 border-pink-800",
  DEPLOY: "bg-orange-900/40 text-orange-300 border-orange-800",
  LISTENING: "bg-slate-700/50 text-slate-300 border-slate-600",
};

function formatHeartbeatAgo(iso: string, now: number = Date.now()): string {
  const ms = now - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  if (ms < 5_000) return "just now";
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}

/**
 * Ticking-clock hook so relative timestamps stay fresh between SSE
 * events. 5s cadence is fine — heartbeats themselves arrive every 30s,
 * so this just smooths the gap. Respects prefers-reduced-motion by
 * staying on a quiet timer (no animations).
 */
function useNowTicker(intervalMs: number = 5_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function StatusDot({ status }: { status: string }): React.JSX.Element {
  const isActive = status === "active";
  return (
    <span
      aria-label={isActive ? "active agent" : "stale agent"}
      className={`h-2 w-2 rounded-full shrink-0 ${
        isActive ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" : "bg-gray-500"
      }`}
    />
  );
}

interface AgentRowProps {
  agent: AgentActivity;
  active: boolean;
  now: number;
  onSelect: (id: string) => void;
}

function AgentRow({ agent, active, now, onSelect }: AgentRowProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(agent.agentId)}
      aria-pressed={active}
      className={`w-full text-left px-3 py-2.5 rounded-md border cursor-pointer transition-colors duration-150 ${
        active
          ? "bg-emerald-900/20 border-emerald-700/60"
          : "bg-gray-800/40 border-gray-700/60 hover:bg-gray-800/70 hover:border-gray-600"
      }`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={agent.status} />
          <span className="text-sm font-medium text-gray-100 truncate">
            {agent.agentId}
          </span>
        </div>
        <span className="text-xs text-gray-500 shrink-0 tabular-nums">
          {formatHeartbeatAgo(agent.lastHeartbeat, now)}
        </span>
      </div>
      <div className="mt-1 text-xs text-gray-400 truncate">
        {agent.currentTaskId ? (
          <>
            <span className="text-gray-500">task </span>
            <code className="text-gray-300">{agent.currentTaskId}</code>
          </>
        ) : (
          <span className="italic text-gray-600">idle</span>
        )}
      </div>
    </button>
  );
}

/**
 * Classify a unified-diff line into one of 5 visual buckets.
 * Order matters: '+++'/'---' headers must outrank '+'/'-' content.
 *
 * Exported for testing; not part of the tab's public surface.
 */
export function classifyDiffLine(line: string): "header" | "hunk" | "add" | "del" | "context" {
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ") || line.startsWith("index ")) {
    return "header";
  }
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return "context";
}

const DIFF_LINE_CLASS: Record<ReturnType<typeof classifyDiffLine>, string> = {
  header: "text-gray-500",
  hunk: "text-cyan-400 bg-cyan-950/30",
  add: "text-emerald-300 bg-emerald-950/30",
  del: "text-rose-300 bg-rose-950/30",
  context: "text-gray-400",
};

interface DiffBodyProps {
  diff: FileDiffPayload;
}

function DiffBody({ diff }: DiffBodyProps): React.JSX.Element {
  const body = diff.diff || "";
  if (body.length === 0) {
    return <p className="px-3 py-2 text-xs text-gray-500 italic">(no diff body)</p>;
  }
  const lines = body.split("\n");
  return (
    <div className="text-[11px] leading-relaxed font-mono overflow-x-auto max-h-80">
      <pre className="m-0">
        {lines.map((line, i) => {
          const kind = classifyDiffLine(line);
          return (
            <code
              key={i}
              className={`block px-3 ${DIFF_LINE_CLASS[kind]} whitespace-pre`}
            >
              {line === "" ? " " : line}
            </code>
          );
        })}
      </pre>
      {diff.truncated && (
        <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-amber-400 bg-amber-950/30 border-t border-amber-900">
          diff truncated at {Math.round(diff.byteCount / 1024)}KB
        </div>
      )}
    </div>
  );
}

interface ChangedFileRowProps {
  agentId: string;
  file: AgentWorkChangedFile;
}

function ChangedFileRow({ agentId, file }: ChangedFileRowProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState<FileDiffPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(): Promise<void> {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (diff !== null) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchFileDiff(agentId, file.path);
      setDiff(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "diff failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="border border-gray-700/60 bg-gray-800/40 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={open}
        aria-label={`Toggle diff for ${file.path}`}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left cursor-pointer hover:bg-gray-800/70 transition-colors duration-150"
      >
        <code className="text-xs text-gray-200 truncate">{file.path}</code>
        <span className="flex items-center gap-2 text-xs tabular-nums shrink-0">
          <span className="text-emerald-400">+{file.additions}</span>
          <span className="text-rose-400">-{file.deletions}</span>
          <span
            aria-hidden
            className={`text-gray-500 transition-transform duration-150 ${
              open ? "rotate-90" : "rotate-0"
            }`}
          >
            ›
          </span>
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-700/60 bg-black/30">
          {loading && <p className="px-3 py-2 text-xs text-gray-500">Loading diff…</p>}
          {error && <p className="px-3 py-2 text-xs text-rose-400">Error: {error}</p>}
          {diff && <DiffBody diff={diff} />}
        </div>
      )}
    </li>
  );
}

/**
 * Pick a single dot color per event type so the timeline scans quickly.
 * Anything we don't recognize falls back to slate-500.
 */
function dotForEvent(type: string): string {
  if (type.startsWith("agent:heartbeat")) return "bg-emerald-500";
  if (type.startsWith("task:claimed")) return "bg-amber-500";
  if (type.startsWith("task:released")) return "bg-blue-500";
  if (type.startsWith("task:status")) return "bg-violet-500";
  if (type.startsWith("hook:")) return "bg-cyan-500";
  if (type.startsWith("memory:")) return "bg-fuchsia-500";
  return "bg-slate-500";
}

interface EventTimelineProps {
  agentId: string;
  now: number;
}

function EventTimeline({ agentId, now }: EventTimelineProps): React.JSX.Element {
  const { data: events, loading, error } = useAgentEvents(agentId, 20);
  if (loading && events.length === 0) {
    return <p className="text-xs text-gray-500">Loading recent activity…</p>;
  }
  if (error) {
    return <p className="text-xs text-rose-400">Activity load failed: {error}</p>;
  }
  if (events.length === 0) {
    return <p className="text-xs text-gray-500 italic">No recent events for this agent.</p>;
  }
  return (
    <ol className="space-y-1.5">
      {events.map((evt: AgentEvent) => (
        <li
          key={evt.id}
          className="flex items-start gap-2 text-xs text-gray-300"
        >
          <span
            aria-hidden
            className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${dotForEvent(evt.type)}`}
          />
          <code className="font-mono text-gray-200 shrink-0">{evt.type}</code>
          <span className="text-gray-500 shrink-0 tabular-nums">
            {formatHeartbeatAgo(evt.createdAt, now)}
          </span>
        </li>
      ))}
    </ol>
  );
}

interface AcChecklistProps {
  items: ReadonlyArray<{ text: string; done: boolean }>;
}

function AcChecklist({ items }: AcChecklistProps): React.JSX.Element | null {
  if (items.length === 0) return null;
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  return (
    <div className="mt-3 pt-3 border-t border-gray-700/60">
      <header className="flex items-baseline justify-between mb-2">
        <h5 className="text-[11px] uppercase tracking-wider text-gray-500">
          Acceptance criteria
        </h5>
        <span className="text-xs text-gray-400 tabular-nums">
          {doneCount}/{items.length} ({pct}%)
        </span>
      </header>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Acceptance criteria progress"
        className="h-1 w-full bg-gray-700/40 rounded mb-2 overflow-hidden"
      >
        <div
          className="h-full bg-emerald-500/80 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <span
              aria-hidden
              className={`mt-0.5 inline-flex items-center justify-center h-3.5 w-3.5 rounded border shrink-0 ${
                it.done
                  ? "border-emerald-700 bg-emerald-700/40 text-emerald-300"
                  : "border-gray-600 bg-gray-800/60 text-transparent"
              }`}
            >
              ✓
            </span>
            <span
              className={
                it.done
                  ? "text-gray-500 line-through"
                  : "text-gray-200"
              }
            >
              {it.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface AgentDetailProps {
  agentId: string;
  now: number;
}

function AgentDetail({ agentId, now }: AgentDetailProps): React.JSX.Element {
  const { data, loading, error } = useAgentWork(agentId);

  if (loading && !data) {
    return <p className="text-sm text-gray-500">Loading agent work…</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-400">Error: {error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-gray-500">No work payload available.</p>;
  }

  const phase = data.currentTask?.lifecyclePhase ?? data.projectPhase;
  const phaseClass = PHASE_BADGE_CLASS[phase] ?? PHASE_BADGE_CLASS["LISTENING"];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-baseline gap-3">
        <h3 className="text-base font-semibold text-white">{data.agent.agentId}</h3>
        <span
          className={`text-[11px] uppercase tracking-wider px-2 py-0.5 rounded border ${phaseClass}`}
        >
          {phase}
        </span>
        <span className="text-xs text-gray-500">
          last heartbeat {formatHeartbeatAgo(data.agent.lastHeartbeat, now)}
        </span>
      </header>

      {data.currentTask ? (
        <section
          aria-labelledby="agent-current-task"
          className="bg-gray-800/40 rounded-md border border-gray-700/60 p-3"
        >
          <h4 id="agent-current-task" className="text-xs uppercase tracking-wider text-gray-500 mb-2">
            Current task
          </h4>
          <p className="text-sm text-gray-100 leading-snug">{data.currentTask.title}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
            <span>
              <span className="text-gray-600">id </span>
              <code className="text-gray-300">{data.currentTask.id}</code>
            </span>
            <span>
              <span className="text-gray-600">status </span>
              <code className="text-gray-300">{data.currentTask.status}</code>
            </span>
            {data.currentTask.startedAt && (
              <span>
                <span className="text-gray-600">started </span>
                <time dateTime={data.currentTask.startedAt} className="text-gray-300">
                  {formatHeartbeatAgo(data.currentTask.startedAt, now)}
                </time>
              </span>
            )}
          </div>
          <AcChecklist items={data.currentTask.acceptanceCriteria} />
        </section>
      ) : (
        <section className="bg-gray-800/40 rounded-md border border-gray-700/60 p-3">
          <p className="text-sm text-gray-500 italic">Agent is idle — no task claimed.</p>
        </section>
      )}

      <section aria-labelledby="agent-recent-activity">
        <header className="flex items-baseline justify-between mb-2">
          <h4
            id="agent-recent-activity"
            className="text-xs uppercase tracking-wider text-gray-500"
          >
            Recent activity
          </h4>
          <span className="text-[10px] text-gray-600">last 20 events</span>
        </header>
        <EventTimeline agentId={data.agent.agentId} now={now} />
      </section>

      <section aria-labelledby="agent-changed-files">
        <header className="flex items-baseline justify-between mb-2">
          <h4
            id="agent-changed-files"
            className="text-xs uppercase tracking-wider text-gray-500"
          >
            Changed files ({data.changedFileCount})
          </h4>
          {data.changedFileCount > 0 && (
            <span className="text-[10px] text-gray-600">click to expand diff</span>
          )}
        </header>
        {data.changedFileCount === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No working-tree changes since HEAD.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {data.changedFiles.map((f) => (
              <ChangedFileRow key={f.path} agentId={data.agent.agentId} file={f} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const SELECTED_AGENT_STORAGE_KEY = "mcp-graph-agents-selected";

function readPersistedSelection(): string | null {
  try {
    return localStorage.getItem(SELECTED_AGENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistSelection(value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(SELECTED_AGENT_STORAGE_KEY);
    else localStorage.setItem(SELECTED_AGENT_STORAGE_KEY, value);
  } catch {
    // ignore — private mode / quota; selection is just ephemeral.
  }
}

/**
 * Sort agents into a deterministic, scan-friendly order:
 *   1. active before stale (status equality groups stay together)
 *   2. within a group, most recent heartbeat first
 *   3. tiebreaker on agentId so the order is stable across refreshes
 *
 * Exported for testing; not part of the tab's public surface.
 */
export function sortAgents<T extends { agentId: string; status: string; lastHeartbeat: string }>(
  agents: ReadonlyArray<T>,
): T[] {
  return [...agents].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (b.status === "active" && a.status !== "active") return 1;
    const ta = new Date(a.lastHeartbeat).getTime();
    const tb = new Date(b.lastHeartbeat).getTime();
    if (tb !== ta) return tb - ta;
    return a.agentId.localeCompare(b.agentId);
  });
}

/** AgentsTab — auto-generated description placeholder. */
export function AgentsTab(): React.JSX.Element {
  const { data, loading, error } = useAgentActivity();
  const agents = useMemo(() => sortAgents(data?.agents ?? []), [data]);
  const [selectedId, setSelectedIdState] = useState<string | null>(() =>
    readPersistedSelection(),
  );
  const setSelectedId = (id: string): void => {
    setSelectedIdState(id);
    persistSelection(id);
  };
  const now = useNowTicker();

  // Auto-select the first active agent when none is selected
  const effectiveSelectedId = useMemo(() => {
    if (selectedId && agents.some((a) => a.agentId === selectedId)) return selectedId;
    return agents[0]?.agentId ?? null;
  }, [selectedId, agents]);

  // §AgentMonitor — clear stale persisted selections so a removed agent
  // doesn't keep its localStorage entry forever. Only fires once we have
  // loaded a non-empty list AND the persisted id is missing from it.
  useEffect(() => {
    if (
      selectedId !== null &&
      agents.length > 0 &&
      !agents.some((a) => a.agentId === selectedId)
    ) {
      persistSelection(null);
      setSelectedIdState(null);
    }
  }, [selectedId, agents]);

  const counts = useMemo(() => {
    const active = agents.filter((a) => a.status === "active").length;
    const stale = agents.length - active;
    const working = agents.filter((a) => a.currentTaskId !== null).length;
    return { active, stale, working };
  }, [agents]);

  return (
    <div className="p-6 max-w-7xl mx-auto h-full overflow-hidden flex flex-col">
      <header className="mb-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-white">Agents</h2>
          {agents.length > 0 && (
            <div
              role="status"
              aria-label="Agent count summary"
              className="flex items-center gap-2 text-xs"
            >
              <span className="px-2 py-0.5 rounded border border-emerald-800 bg-emerald-900/30 text-emerald-300 tabular-nums">
                {counts.active} active
              </span>
              {counts.stale > 0 && (
                <span className="px-2 py-0.5 rounded border border-gray-700 bg-gray-800/40 text-gray-400 tabular-nums">
                  {counts.stale} stale
                </span>
              )}
              <span className="px-2 py-0.5 rounded border border-amber-800 bg-amber-900/20 text-amber-300 tabular-nums">
                {counts.working} working
              </span>
            </div>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-1">
          Live view of agents working in this project. Click an agent to inspect its
          current task, lifecycle phase, and code diffs in the working tree.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 px-3 py-2 rounded-md border border-rose-800 bg-rose-900/30 text-sm text-rose-300"
        >
          Failed to load agent activity: {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Left column — agent list */}
        <aside
          className="lg:col-span-1 bg-gray-800/30 rounded-lg border border-gray-700 p-3 overflow-y-auto"
          aria-label="Agent list"
        >
          {loading && agents.length === 0 ? (
            <p className="text-sm text-gray-500">Loading agents…</p>
          ) : agents.length === 0 ? (
            <div className="text-sm text-gray-500 space-y-2">
              <p className="italic">No agents have heartbeat in the last 60s.</p>
              <p className="text-xs text-gray-600">
                Start the autopilot or a teamTask agent to populate this view.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {agents.map((agent) => (
                <li key={agent.agentId}>
                  <AgentRow
                    agent={agent}
                    active={agent.agentId === effectiveSelectedId}
                    now={now}
                    onSelect={setSelectedId}
                  />
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Right column — detail */}
        <section
          className="lg:col-span-2 bg-gray-800/30 rounded-lg border border-gray-700 p-4 overflow-y-auto"
          aria-label="Agent detail"
        >
          {effectiveSelectedId ? (
            <AgentDetail key={effectiveSelectedId} agentId={effectiveSelectedId} now={now} />
          ) : (
            <p className="text-sm text-gray-500 italic">
              Select an agent on the left to see its current task and diffs.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
