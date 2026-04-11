import { useState, useCallback } from "react";
import { useKanbanBoard } from "@/hooks/use-kanban";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { KanbanToolbar } from "@/components/kanban/kanban-toolbar";
import { KanbanMetrics } from "@/components/kanban/kanban-metrics";
import { KanbanSuggestions } from "@/components/kanban/kanban-suggestions";
import type { SwimlaneMode, KanbanSuggestion } from "@/lib/types";

export function KanbanTab(): React.JSX.Element {
  const [swimlaneMode, setSwimlaneMode] = useState<SwimlaneMode>("none");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { board, suggestions, loading, error, refresh, moveCard } = useKanbanBoard(swimlaneMode);

  const handleMoveCard = useCallback(
    async (nodeId: string, newStatus: string) => {
      await moveCard(nodeId, newStatus);
    },
    [moveCard],
  );

  const handleApplySuggestion = useCallback(
    async (suggestion: KanbanSuggestion) => {
      if (suggestion.action === "promote_ready") {
        await moveCard(suggestion.nodeId, "ready");
      } else if (suggestion.action === "unblock") {
        await moveCard(suggestion.nodeId, "ready");
      } else if (suggestion.action === "start_next") {
        await moveCard(suggestion.nodeId, "in_progress");
      }
    },
    [moveCard],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted">
        Loading Kanban board...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-danger">
        {error}
      </div>
    );
  }

  if (!board) return <div />;

  return (
    <div className="flex flex-col h-full">
      <KanbanToolbar
        swimlaneMode={swimlaneMode}
        onSwimlaneChange={setSwimlaneMode}
        suggestionsCount={suggestions.length}
        showSuggestions={showSuggestions}
        onToggleSuggestions={() => setShowSuggestions((prev) => !prev)}
        onRefresh={refresh}
      />
      <KanbanMetrics metrics={board.metrics} />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <KanbanBoard
            board={board}
            onMoveCard={handleMoveCard}
          />
        </div>
        {showSuggestions && (
          <KanbanSuggestions
            suggestions={suggestions}
            onApply={handleApplySuggestion}
          />
        )}
      </div>
    </div>
  );
}
