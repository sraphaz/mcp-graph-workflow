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

import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import type { GraphStats } from "@/lib/types";

interface UseStatsReturn {
  stats: GraphStats | null;
  refresh: () => Promise<void>;
}

export function useStats(): UseStatsReturn {
  const [stats, setStats] = useState<GraphStats | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiClient.getStats();
      setStats(data);
    } catch {
      // silently fail — stats are non-critical
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, refresh };
}
