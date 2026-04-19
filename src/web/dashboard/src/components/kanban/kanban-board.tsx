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
