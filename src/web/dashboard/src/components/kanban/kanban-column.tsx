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

import { memo, useState } from "react";
import type { KanbanColumn as KanbanColumnType } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/constants";
import { KanbanCard } from "./kanban-card";

interface KanbanColumnProps {
  column: KanbanColumnType;
  onDragStart: (e: React.DragEvent, nodeId: string) => void;
  onDrop: (nodeId: string, newStatus: string) => void;
  onCardClick?: (nodeId: string) => void;
}

export const KanbanColumn = memo(function KanbanColumn({
  column,
  onDragStart,
  onDrop,
  onCardClick,
}: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  const statusColor = STATUS_COLORS[column.status] || "#9e9e9e";
  const isOverWip = column.wipLimit > 0 && column.cards.length > column.wipLimit;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const nodeId = e.dataTransfer.getData("text/plain");
    if (nodeId) {
      onDrop(nodeId, column.status);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        flex flex-col min-w-[220px] w-[260px] flex-shrink-0 rounded-lg
        ${dragOver ? "bg-accent/5 ring-2 ring-accent/30" : "bg-surface"}
        ${isOverWip ? "ring-2 ring-red-500/50" : ""}
        transition-all
      `}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-edge">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusColor }}
          />
          <h3 className="text-xs font-semibold text-foreground">{column.title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-[10px] font-medium ${isOverWip ? "text-red-400" : "text-muted"}`}>
            {column.cards.length}
            {column.wipLimit > 0 ? `/${column.wipLimit}` : ""}
          </span>
        </div>
      </div>

      {/* Cards list */}
      <div className="flex-1 overflow-y-auto p-2 min-h-[100px]">
        {column.cards.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[10px] text-muted py-6">
            No tasks
          </div>
        ) : (
          column.cards.map((card) => (
            <KanbanCard
              key={card.node.id}
              card={card}
              onDragStart={onDragStart}
              onClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
});
