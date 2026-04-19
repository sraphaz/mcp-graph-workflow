/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * useTranslationHistory — fetches and manages translation job history.
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type { TranslationJob, TranslationStats } from "@/lib/types";

export interface UseTranslationHistoryState {
  jobs: TranslationJob[];
  stats: TranslationStats | null;
  loading: boolean;
  error: string | null;
}

export interface UseTranslationHistoryActions {
  refresh: () => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
}

export function useTranslationHistory(): [UseTranslationHistoryState, UseTranslationHistoryActions] {
  const [jobs, setJobs] = useState<TranslationJob[]>([]);
  const [stats, setStats] = useState<TranslationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, statsRes] = await Promise.all([
        apiClient.translationListJobs(),
        apiClient.translationStats(),
      ]);
      setJobs(jobsRes.jobs);
      setStats(statsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteJob = useCallback(async (id: string) => {
    try {
      await apiClient.translationDeleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      // Refresh stats after delete to keep counters in sync
      const statsRes = await apiClient.translationStats();
      setStats(statsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return [{ jobs, stats, loading, error }, { refresh, deleteJob }];
}
