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

import { memo } from "react";
import type { SwimlaneMode } from "@/lib/types";
import { RefreshCw, Lightbulb } from "lucide-react";

interface KanbanToolbarProps {
  swimlaneMode: SwimlaneMode;
  onSwimlaneChange: (mode: SwimlaneMode) => void;
  suggestionsCount: number;
  showSuggestions: boolean;
  onToggleSuggestions: () => void;
  onRefresh: () => void;
}

export const KanbanToolbar = memo(function KanbanToolbar({
  swimlaneMode,
  onSwimlaneChange,
  suggestionsCount,
  showSuggestions,
  onToggleSuggestions,
  onRefresh,
}: KanbanToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-edge bg-surface-alt">
      <div className="flex items-center gap-3">
        {/* Swimlane selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted font-medium">Swimlane:</span>
          <div className="flex rounded-lg border border-edge overflow-hidden">
            {(["none", "epic", "sprint"] as SwimlaneMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onSwimlaneChange(mode)}
                className={`
                  px-2.5 py-1 text-[10px] font-medium transition-colors
                  ${swimlaneMode === mode
                    ? "bg-accent text-white"
                    : "text-muted hover:bg-surface-elevated hover:text-foreground"
                  }
                `}
              >
                {mode === "none" ? "None" : mode === "epic" ? "Epic" : "Sprint"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Suggestions toggle */}
        <button
          onClick={onToggleSuggestions}
          className={`
            inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded-lg
            transition-colors border
            ${showSuggestions
              ? "bg-accent/10 text-accent border-accent"
              : "border-edge text-muted hover:bg-surface-elevated"
            }
          `}
        >
          <Lightbulb className="w-3 h-3" />
          Suggestions
          {suggestionsCount > 0 && (
            <span className="ml-0.5 px-1 py-0.5 rounded-full text-[9px] bg-accent text-white">
              {suggestionsCount}
            </span>
          )}
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg text-muted hover:bg-surface-elevated hover:text-foreground transition-colors"
          title="Refresh board"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});
