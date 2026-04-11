import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type { KanbanBoard, KanbanSuggestion, SwimlaneMode } from "@/lib/types";

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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const moveCard = useCallback(async (nodeId: string, newStatus: string) => {
    const result = await apiClient.moveKanbanCard(nodeId, newStatus);
    if (result.success) {
      await refresh();
    }
    return result;
  }, [refresh]);

  return { board, suggestions, loading, error, refresh, moveCard };
}
