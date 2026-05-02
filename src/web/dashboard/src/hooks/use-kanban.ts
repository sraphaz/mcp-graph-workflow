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

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { useSSE } from "@/hooks/use-sse";
import type { KanbanBoard, KanbanSuggestion, SwimlaneMode } from "@/lib/types";

/** useKanbanBoard — auto-generated description placeholder. */
export function useKanbanBoard(swimlane?: SwimlaneMode) {
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [suggestions, setSuggestions] = useState<KanbanSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [boardData, suggestionsData] = await Promise.all([
        apiClient.getKanbanBoard(swimlane),
        apiClient.getKanbanSuggestions(),
      ]);
      setBoard(boardData);
      setSuggestions(suggestionsData.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Kanban board");
    } finally {
      setLoading(false);
    }
  }, [swimlane]);

  // Stable ref for SSE callback — avoids re-registering listeners on each render
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // SSE: auto-refresh kanban when node status or structure changes
  // Uses stable callback via ref to prevent duplicate SSE listener registration
  useSSE(useCallback((event: string) => {
    if (event.startsWith("node:") || event.startsWith("edge:") || event === "import:completed") {
      void refreshRef.current();
    }
  }, []));

  const moveCard = useCallback(async (nodeId: string, newStatus: string) => {
    const result = await apiClient.moveKanbanCard(nodeId, newStatus);
    if (result.success) {
      await refresh();
    }
    return result;
  }, [refresh]);

  return { board, suggestions, loading, error, refresh, moveCard };
}
