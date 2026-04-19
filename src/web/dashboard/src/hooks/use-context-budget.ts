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

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type { ContextBudget } from "@/lib/types";

export interface UseContextBudgetReturn {
  budget: ContextBudget | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useContextBudget(): UseContextBudgetReturn {
  const [budget, setBudget] = useState<ContextBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getContextBudget();
      setBudget(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load context budget");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { budget, loading, error, refresh: load };
}
