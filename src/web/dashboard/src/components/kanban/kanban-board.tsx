import { memo, useCallback } from "react";
import type { KanbanBoard as KanbanBoardType, KanbanSuggestion } from "@/lib/types";
import { KanbanColumn } from "./kanban-column";

interface KanbanBoardProps {
  board: KanbanBoardType;
  onMoveCard: (nodeId: string, newStatus: string) => void;
  onCardClick?: (nodeId: string) => void;
}

export const KanbanBoard = memo(function KanbanBoard({
  board,
  onMoveCard,
  onCardClick,
}: KanbanBoardProps) {
  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    e.dataTransfer.setData("text/plain", nodeId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDrop = useCallback(
    (nodeId: string, newStatus: string) => {
      onMoveCard(nodeId, newStatus);
    },
    [onMoveCard],
  );

  return (
    <div className="flex gap-3 p-4 overflow-x-auto h-full">
      {board.columns.map((column) => (
        <KanbanColumn
          key={column.status}
          column={column}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  );
});
