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
import type { KanbanCard as KanbanCardType } from "@/lib/types";

interface KanbanCardProps {
  card: KanbanCardType;
  onDragStart: (e: React.DragEvent, nodeId: string) => void;
  onClick?: (nodeId: string) => void;
}

export const KanbanCard = memo(function KanbanCard({ card, onDragStart, onClick }: KanbanCardProps) {
  const { node, blockerCount, dependencyCount, isNext, epicTitle } = card;
  const [showMenu, setShowMenu] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.(node.id);
    }
  };

  const ariaLabel = `${node.title}, priority ${node.priority}${node.xpSize ? `, size ${node.xpSize}` : ""}${isNext ? ", recommended next" : ""}${blockerCount > 0 ? `, ${blockerCount} blocker${blockerCount > 1 ? "s" : ""}` : ""}`;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, node.id)}
      onClick={() => onClick?.(node.id)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className={`
        relative p-2.5 mb-2 rounded-lg border cursor-grab active:cursor-grabbing
        bg-surface-alt hover:bg-surface-elevated transition-colors
        ${isNext ? "ring-2 ring-accent border-accent" : "border-edge"}
      `}
    >
      {/* Top row: badges + action menu */}
      <div className="flex items-center gap-1.5 mb-1">
        {isNext && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent text-white">
            NEXT
          </span>
        )}
        <span className="text-[10px] font-medium text-muted">P{node.priority}</span>
        {node.xpSize && (
          <span className="text-[10px] font-medium text-muted">{node.xpSize}</span>
        )}
        <button
          tabIndex={0}
          aria-haspopup="true"
          aria-expanded={showMenu}
          aria-label="Card actions"
          className="ml-auto text-muted hover:text-foreground text-xs px-1 rounded hover:bg-surface-elevated transition-colors"
          onClick={(e) => { e.stopPropagation(); setShowMenu((prev) => !prev); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault();
              e.stopPropagation();
              setShowMenu(true);
            }
            if (e.key === "Escape") {
              setShowMenu(false);
            }
          }}
        >
          ⋯
        </button>
      </div>
      {showMenu && (
        <div
          role="menu"
          className="absolute right-1 top-8 z-20 bg-surface-elevated border border-edge rounded shadow-lg py-1 min-w-[120px]"
          onKeyDown={(e) => { if (e.key === "Escape") setShowMenu(false); }}
        >
          <button
            role="menuitem"
            tabIndex={0}
            className="w-full text-left px-3 py-1 text-[10px] hover:bg-accent/10 hover:text-accent transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowMenu(false); onClick?.(node.id); }}
          >
            View details
          </button>
        </div>
      )}

      {/* Title */}
      <p className="text-xs font-medium text-foreground leading-snug mb-1 line-clamp-2">
        {node.title}
      </p>

      {/* Bottom row: metadata */}
      <div className="flex items-center gap-2 flex-wrap">
        {epicTitle && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 truncate max-w-[120px]">
            {epicTitle}
          </span>
        )}
        {blockerCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
            {blockerCount} blocker{blockerCount > 1 ? "s" : ""}
          </span>
        )}
        {dependencyCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-500/10 text-muted">
            {dependencyCount} dep{dependencyCount > 1 ? "s" : ""}
          </span>
        )}
        {node.tags && node.tags.length > 0 && (
          <span className="text-[9px] text-muted truncate max-w-[80px]">
            {node.tags[0]}
          </span>
        )}
      </div>
    </div>
  );
});
