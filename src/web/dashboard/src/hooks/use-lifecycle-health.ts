/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §SprintF — Hooks for the Lifecycle Health dashboard tab.
 */

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

export interface LifecycleSnapshot {
  id: string;
  epicId: string | null;
  passedAll: boolean;
  takenAt: string;
  takenOn: string;
  report: {
    epicId: string;
    passedCount: number;
    passedAll: boolean;
    summary: string;
    phases?: Record<string, { passed: boolean; reason?: string }>;
  } | null;
}

export interface SuccessRateData {
  window: number;
  samples: number;
  passed: number;
  successRate: number;
  latestPassedAll: boolean | null;
  summary: string;
}

/** useLifecycleSnapshots — auto-generated description placeholder. */
export function useLifecycleSnapshots(epicId?: string, limit = 30) {
  const [data, setData] = useState<LifecycleSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (epicId) params.set("epicId", epicId);
        params.set("limit", String(limit));
        const result = await apiClient.request<{ snapshots: LifecycleSnapshot[] }>(
          `/lifecycle-health/snapshots?${params.toString()}`,
        );
        if (!cancelled) setData(result.snapshots);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [epicId, limit]);

  return { data, loading, error };
}

/** useLifecycleTrend — auto-generated description placeholder. */
export function useLifecycleTrend(window = 10, epicId?: string) {
  const [data, setData] = useState<SuccessRateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ window: String(window) });
        if (epicId) params.set("epicId", epicId);
        const result = await apiClient.request<SuccessRateData>(
          `/lifecycle-health/trend?${params.toString()}`,
        );
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [window, epicId]);

  return { data, loading, error };
}
