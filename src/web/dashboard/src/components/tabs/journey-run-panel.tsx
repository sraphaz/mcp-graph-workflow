/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Journey Run panel — renders inside the Journey tab. Lets the user pick a
 * variant, connect to a CDP endpoint, and trigger a run whose step-by-step
 * progress (with OCR complement and screenshots) is streamed live via SSE
 * and saved automatically. When the verdict arrives, the panel flips into
 * "Done" mode showing the full report.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type {
  JourneyMapFull,
  JourneyPlannedStep,
  JourneyRun,
  JourneyRunEvent,
  JourneyRunVerdict,
} from "@/lib/types";

interface Props {
  map: JourneyMapFull;
}

type Mode = "idle" | "live" | "done";

const API_BASE = "/api/v1/journey";

/** JourneyRunPanel — auto-generated description placeholder. */
export function JourneyRunPanel({ map }: Props): React.JSX.Element {
  const [endpoint, setEndpoint] = useState("ws://127.0.0.1:9222/devtools/browser/");
  const [variantId, setVariantId] = useState<string | null>(map.variants[0]?.id ?? null);
  const [mode, setMode] = useState<Mode>("idle");
  const [plan, setPlan] = useState<JourneyPlannedStep[]>([]);
  const [steps, setSteps] = useState<Map<number, { ok: boolean; durationMs: number; error: string | null; screenId: string | null; helper: string }>>(new Map());
  const [ocrByStep, setOcrByStep] = useState<Map<number, { text: string; confidence: number }>>(new Map());
  const [verdict, setVerdict] = useState<JourneyRunVerdict | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [doneRun, setDoneRun] = useState<JourneyRun | null>(null);
  const [history, setHistory] = useState<JourneyRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refreshHistory = useCallback(async () => {
    try {
      const r = await apiClient.listJourneyRuns(map.id);
      setHistory(r.runs);
    } catch {
      setHistory([]);
    }
  }, [map.id]);

  useEffect(() => { void refreshHistory(); }, [refreshHistory]);

  // Load full run detail once we flip to done mode
  useEffect(() => {
    if (mode !== "done" || !currentRunId) return;
    let cancelled = false;
    (async () => {
      try {
        const run = await apiClient.getJourneyRun(currentRunId);
        if (!cancelled) setDoneRun(run);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [mode, currentRunId]);

  const startRun = useCallback(async () => {
    setError(null);
    setBusy(true);
    setMode("live");
    setPlan([]);
    setSteps(new Map());
    setOcrByStep(new Map());
    setVerdict(null);
    setCurrentRunId(null);
    setDoneRun(null);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API_BASE}/maps/${map.id}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, cdpEndpoint: endpoint }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Run failed to start: ${res.status} ${text}`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let buffer = "";

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
            const event = JSON.parse(dataLine.slice("data: ".length)) as JourneyRunEvent;
            handleEvent(event);
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
      void refreshHistory();
    }
  }, [map.id, variantId, endpoint, refreshHistory]);

  function handleEvent(event: JourneyRunEvent): void {
    if (event.type === "plan") {
      setPlan(event.steps);
    } else if (event.type === "step") {
      setSteps((m) => {
        const next = new Map(m);
        next.set(event.index, {
          ok: event.ok, durationMs: event.durationMs, error: event.error,
          screenId: event.screenId, helper: event.helper,
        });
        return next;
      });
    } else if (event.type === "ocr") {
      setOcrByStep((m) => {
        const next = new Map(m);
        next.set(event.index, { text: event.text, confidence: event.confidence });
        return next;
      });
    } else if (event.type === "verdict") {
      setVerdict(event.verdict);
      setCurrentRunId(event.runId);
      setMode("done");
    } else if (event.type === "done") {
      setCurrentRunId(event.runId);
      setMode("done");
    } else if (event.type === "error") {
      setError(event.error);
    }
  }

  const screenTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of map.screens) m.set(s.id, s.title);
    return m;
  }, [map.screens]);

  return (
    <div className="w-96 h-full border-l border-edge bg-surface overflow-y-auto flex flex-col">
      {/* Controls */}
      <div className="p-3 border-b border-edge space-y-2">
        <div className="text-sm font-semibold">Run journey</div>
        <div>
          <label className="block text-[10px] uppercase text-muted mb-0.5">Variant</label>
          <select
            className="w-full text-xs bg-surface-alt border border-edge rounded px-2 py-1"
            value={variantId ?? ""}
            onChange={(e) => setVariantId(e.target.value || null)}
            disabled={busy}
          >
            <option value="">All screens</option>
            {map.variants.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase text-muted mb-0.5">CDP Endpoint</label>
          <input
            className="w-full text-xs font-mono bg-surface-alt border border-edge rounded px-2 py-1"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            disabled={busy}
            placeholder="ws://127.0.0.1:9222/devtools/browser/<id>"
          />
        </div>
        <button
          onClick={startRun}
          disabled={busy}
          className="w-full px-3 py-1.5 rounded bg-emerald-600 text-white text-sm font-medium disabled:opacity-40"
        >
          {busy ? "Running…" : "Run"}
        </button>
        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>

      {/* Live pipeline */}
      {mode === "live" && plan.length > 0 && (
        <div className="p-3 border-b border-edge">
          <h3 className="text-xs font-semibold mb-2">Live Pipeline</h3>
          <ol className="space-y-1.5">
            {plan.map((step) => {
              const r = steps.get(step.index);
              const ocr = ocrByStep.get(step.index);
              const status = !r ? "pending" : r.ok ? "pass" : "fail";
              const color =
                status === "pass" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                : status === "fail" ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                : "border-slate-300";
              return (
                <li key={step.index} className={`rounded border-l-4 ${color} px-2 py-1 text-xs`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      <strong>#{step.index}</strong> <code>{step.helper}</code>
                      {step.screenId && (
                        <span className="ml-1 text-muted">
                          → {screenTitleById.get(step.screenId) ?? step.screenId}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted">{r ? `${r.durationMs}ms` : "…"}</span>
                  </div>
                  {r?.error && <div className="text-[10px] text-red-700">{r.error}</div>}
                  {ocr && (
                    <details className="mt-1">
                      <summary className="text-[10px] text-muted cursor-pointer">
                        OCR ({Math.round(ocr.confidence)}%)
                      </summary>
                      <pre className="text-[10px] whitespace-pre-wrap break-words mt-0.5 text-muted">
                        {ocr.text.slice(0, 400)}
                      </pre>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Done report */}
      {mode === "done" && verdict && currentRunId && (
        <div className="p-3 border-b border-edge space-y-2">
          <div className="text-sm font-semibold">
            Verdict:{" "}
            <span className={
              verdict === "pass" ? "text-emerald-600" :
              verdict === "fail" ? "text-red-600" : "text-amber-600"
            }>
              {verdict.toUpperCase()}
            </span>
          </div>
          {doneRun && (
            <div className="text-[10px] text-muted">
              Run {doneRun.id} · {doneRun.durationMs}ms · {doneRun.results.length} steps
            </div>
          )}
          {doneRun && (
            <ol className="space-y-1.5">
              {doneRun.results.map((r) => (
                <li key={r.index} className={`rounded border-l-4 ${r.ok ? "border-emerald-500" : "border-red-500"} px-2 py-1 text-xs`}>
                  <div className="flex items-center justify-between">
                    <span className="truncate">
                      <strong>#{r.index}</strong> <code>{r.helper}</code>
                      {r.screenId && (
                        <span className="ml-1 text-muted">
                          → {screenTitleById.get(r.screenId) ?? r.screenId}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted">{r.durationMs}ms</span>
                  </div>
                  {r.error && <div className="text-[10px] text-red-700">{r.error}</div>}
                  {r.screenshotPath && (
                    <img
                      src={apiClient.journeyRunScreenshotUrl(doneRun.id, r.index)}
                      alt={`step ${r.index}`}
                      className="mt-1 w-full rounded border border-edge"
                      loading="lazy"
                    />
                  )}
                  {r.ocrText && (
                    <details className="mt-1">
                      <summary className="text-[10px] text-muted cursor-pointer">OCR text</summary>
                      <pre className="text-[10px] whitespace-pre-wrap break-words text-muted">{r.ocrText}</pre>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="p-3">
          <h3 className="text-xs font-semibold mb-2">History</h3>
          <ul className="space-y-1">
            {history.slice(0, 10).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded px-2 py-1 hover:bg-surface-alt cursor-pointer text-xs"
                onClick={() => { setCurrentRunId(r.id); setMode("done"); setVerdict(r.verdict); }}
              >
                <span className="truncate">
                  <code className="text-[10px]">{r.id}</code>{" "}
                  <span className="text-muted">{new Date(r.createdAt).toLocaleString()}</span>
                </span>
                <span className={
                  r.verdict === "pass" ? "text-emerald-600" :
                  r.verdict === "fail" ? "text-red-600" :
                  r.verdict === "running" ? "text-blue-600" : "text-amber-600"
                }>
                  {r.verdict.toUpperCase()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
