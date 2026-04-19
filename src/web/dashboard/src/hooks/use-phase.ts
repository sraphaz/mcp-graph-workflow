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

interface PhaseData {
  currentPhase: string;
  isOverride: boolean;
  guidance: {
    reminder: string;
    suggestedTools: string[];
    principles: string[];
    suggestedSkills: string[];
  };
}

interface UsePhaseResult {
  phase: PhaseData | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function usePhase(): UsePhaseResult {
  const [phase, setPhase] = useState<PhaseData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiClient.getPhase();
      setPhase(data);
    } catch {
      // Phase endpoint may not exist yet — silently ignore
      setPhase(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { phase, loading, refresh };
}
