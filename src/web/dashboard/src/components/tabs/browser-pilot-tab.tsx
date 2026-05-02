/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Browser Pilot tab — chat-driven browser-harness with live pipeline view
 * and downloadable test reports (HTML/MD/Octane XML).
 */

import React, { useState, useEffect, useCallback, useRef } from "react";

interface PlannedStep {
  index: number;
  helper: string;
  args: Record<string, unknown>;
}

interface StepEvent {
  type: "plan" | "step" | "verdict" | "done" | "error";
  steps?: PlannedStep[];
  index?: number;
  helper?: string;
  ok?: boolean;
  durationMs?: number;
  error?: string | null;
  verdict?: "pass" | "fail" | "error";
  runId?: string;
}

interface RunSummary {
  id: string;
  prompt: string;
  verdict: "pass" | "fail" | "error";
  durationMs: number;
  createdAt: number;
  results: Array<{ index: number; helper: string; ok: boolean; durationMs: number }>;
}

interface SessionState {
  id: string;
  endpoint: string;
}

const API_BASE = "/api/v1/browser-harness";

/** BrowserPilotTab — auto-generated description placeholder. */
export function BrowserPilotTab(): React.JSX.Element {
  const [endpoint, setEndpoint] = useState("ws://127.0.0.1:9222/devtools/browser/");
  const [session, setSession] = useState<SessionState | null>(null);
  const [prompt, setPrompt] = useState("open https://example.com and verify h1");
  const [steps, setSteps] = useState<Map<number, StepEvent>>(new Map());
  const [plan, setPlan] = useState<PlannedStep[]>([]);
  const [verdict, setVerdict] = useState<"pass" | "fail" | "error" | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refreshRuns = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/runs`);
      const j = await r.json() as { runs: RunSummary[] };
      setRuns(j.runs ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { void refreshRuns(); }, [refreshRuns]);

  const startSession = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cdpEndpoint: endpoint }),
      });
      const j = await r.json() as { ok: boolean; session?: SessionState; error?: string };
      if (!j.ok || !j.session) {
        setError(j.error ?? "session failed");
        return;
      }
      setSession({ id: j.session.id, endpoint: j.session.endpoint });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [endpoint]);

  const stopSession = useCallback(async () => {
    if (!session) return;
    await fetch(`${API_BASE}/sessions/${session.id}`, { method: "DELETE" });
    setSession(null);
  }, [session]);

  const submit = useCallback(async () => {
    if (!session) {
      setError("Connect to a CDP endpoint first.");
      return;
    }
    setBusy(true);
    setError(null);
    setSteps(new Map());
    setPlan([]);
    setVerdict(null);
    setCurrentRunId(null);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const r = await fetch(`${API_BASE}/sessions/${session.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: ctrl.signal,
      });

      const reader = r.body?.getReader();
      if (!reader) throw new Error("no response stream");
      const decoder = new TextDecoder();
      let buffer = "";

      // SSE parse loop
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const event = JSON.parse(dataLine.slice("data: ".length)) as StepEvent;
            handleEvent(event);
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
      void refreshRuns();
    }
  }, [session, prompt, refreshRuns]);

  function handleEvent(event: StepEvent): void {
    if (event.type === "plan" && event.steps) {
      setPlan(event.steps);
    } else if (event.type === "step" && typeof event.index === "number") {
      setSteps((m) => {
        const next = new Map(m);
        next.set(event.index!, event);
        return next;
      });
    } else if (event.type === "verdict" && event.verdict) {
      setVerdict(event.verdict);
      if (event.runId) setCurrentRunId(event.runId);
    } else if (event.type === "done" && event.runId) {
      setCurrentRunId(event.runId);
    } else if (event.type === "error" && event.error) {
      setError(event.error);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Browser Pilot</h1>
        <p className="text-sm text-muted-foreground">
          Chat → plan → live test execution. Reports are downloadable as HTML, Markdown, or ALM-Octane XML.
        </p>
      </header>

      {/* Session controls */}
      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className={"inline-block h-2 w-2 rounded-full " + (session ? "bg-green-500" : "bg-slate-400")} />
          {session ? `Connected — ${session.id}` : "Disconnected"}
        </div>
        {!session ? (
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border px-3 py-2 text-sm font-mono"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="ws://127.0.0.1:9222/devtools/browser/<id>"
            />
            <button onClick={startSession} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">
              Connect
            </button>
          </div>
        ) : (
          <button onClick={stopSession} className="rounded border px-3 py-2 text-sm">
            Disconnect
          </button>
        )}
      </section>

      {/* Chat input */}
      <section className="rounded-lg border p-4 space-y-3">
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the test in plain English…"
        />
        <div className="flex gap-2">
          <button
            disabled={busy || !session}
            onClick={submit}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Running…" : "Run test"}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </section>

      {/* Live pipeline */}
      {plan.length > 0 && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Live Pipeline</h2>
          <ol className="space-y-2">
            {plan.map((step) => {
              const r = steps.get(step.index);
              const status = !r ? "pending" : r.ok ? "pass" : "fail";
              const color = status === "pass" ? "border-emerald-500 bg-emerald-50" : status === "fail" ? "border-red-500 bg-red-50" : "border-slate-300";
              return (
                <li key={step.index} className={`rounded border-l-4 ${color} px-3 py-2 text-sm`}>
                  <div className="flex items-center justify-between">
                    <span><strong>#{step.index}</strong> <code>{step.helper}</code></span>
                    <span className="text-xs text-muted-foreground">{r?.durationMs ?? "…"}ms</span>
                  </div>
                  <code className="text-xs text-slate-600">{JSON.stringify(step.args)}</code>
                  {r?.error && <div className="text-xs text-red-700">{r.error}</div>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Verdict + downloads */}
      {verdict && currentRunId && (
        <section className="rounded-lg border p-4 space-y-3">
          <div className="text-lg font-semibold">
            Verdict:{" "}
            <span className={verdict === "pass" ? "text-emerald-600" : "text-red-600"}>{verdict.toUpperCase()}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <a className="rounded border px-3 py-1.5" href={`${API_BASE}/runs/${currentRunId}/report.html`} target="_blank" rel="noreferrer">
              View HTML report
            </a>
            <a className="rounded border px-3 py-1.5" href={`${API_BASE}/runs/${currentRunId}/report.md`} download>
              Download Markdown
            </a>
            <a className="rounded border px-3 py-1.5" href={`${API_BASE}/runs/${currentRunId}/report.octane.xml`} download>
              Download ALM-Octane XML
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            For PDF, open the HTML report and use your browser's "Save as PDF" or feed it back through the harness via Page.printToPDF.
          </p>
        </section>
      )}

      {/* History */}
      {runs.length > 0 && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">Past runs</h2>
          <ul className="space-y-1 text-sm">
            {runs.slice(0, 10).map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-100">
                <span className="truncate">
                  <code className="text-xs">{r.id}</code> — {r.prompt.slice(0, 80)}
                </span>
                <span className={r.verdict === "pass" ? "text-emerald-600" : "text-red-600"}>
                  {r.verdict.toUpperCase()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default BrowserPilotTab;
