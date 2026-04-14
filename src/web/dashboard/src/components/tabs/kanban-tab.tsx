import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useKanbanBoard } from "@/hooks/use-kanban";
import { FullscreenButton } from "../ui/fullscreen-button";
import { FullscreenOverlay } from "../ui/fullscreen-overlay";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { KanbanToolbar } from "@/components/kanban/kanban-toolbar";
import { KanbanMetrics } from "@/components/kanban/kanban-metrics";
import { KanbanSuggestions } from "@/components/kanban/kanban-suggestions";
import { STATUS_COLORS } from "@/lib/constants";
import type { SwimlaneMode, KanbanSuggestion, KanbanCard } from "@/lib/types";
import type { TabId } from "@/components/layout/nav-config";
import { GitBranch, Eye, Clock, Tag, ChevronRight } from "lucide-react";

interface KanbanTabProps {
  onNavigate?: (tab: TabId) => void;
}

export function KanbanTab({ onNavigate }: KanbanTabProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [swimlaneMode, setSwimlaneMode] = useState<SwimlaneMode>("none");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { board, suggestions, loading, error, refresh, moveCard } = useKanbanBoard(swimlaneMode);

  // Find the selected card across all columns
  const selectedCard: KanbanCard | null = useMemo(() => {
    if (!selectedNodeId || !board) return null;
    for (const column of board.columns) {
      const card = column.cards.find((c) => c.node.id === selectedNodeId);
      if (card) return card;
    }
    return null;
  }, [selectedNodeId, board]);

  // Close drawer on Escape
  useEffect(() => {
    if (!selectedNodeId) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setSelectedNodeId(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId]);

  const handleCardClick = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

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
    <div ref={containerRef} className="relative flex flex-col h-full">
      <div className="absolute top-2 right-2 z-10">
        <FullscreenButton containerRef={containerRef} tabName="Kanban" />
      </div>
      <FullscreenOverlay tabName="Kanban" />
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
            onCardClick={handleCardClick}
          />
        </div>
        {showSuggestions && (
          <KanbanSuggestions
            suggestions={suggestions}
            onApply={handleApplySuggestion}
          />
        )}
        {/* Task Detail Drawer */}
        {selectedCard && (
          <div className="w-[360px] flex-shrink-0 border-l border-edge bg-surface overflow-y-auto">
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">Task Details</h3>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="text-muted hover:text-foreground text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-1.5 mb-3">
                <button
                  onClick={() => onNavigate?.("graph")}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-edge hover:bg-surface-elevated hover:border-accent/30 transition-colors"
                >
                  <GitBranch className="w-3 h-3" />
                  View in Graph
                  <ChevronRight className="w-2.5 h-2.5 opacity-50" />
                </button>
                <button
                  onClick={() => onNavigate?.("prd-backlog")}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-edge hover:bg-surface-elevated hover:border-accent/30 transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  View in PRD
                  <ChevronRight className="w-2.5 h-2.5 opacity-50" />
                </button>
              </div>

              {/* Title */}
              <p className="text-sm font-medium text-foreground mb-3 leading-snug">
                {selectedCard.node.title}
              </p>

              {/* Status + Type + Priority + Size badges */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full text-white font-medium"
                  style={{ backgroundColor: STATUS_COLORS[selectedCard.node.status] || "#9e9e9e" }}
                >
                  {selectedCard.node.status.replace("_", " ")}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 font-medium">
                  {selectedCard.node.type}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">
                  P{selectedCard.node.priority}
                </span>
                {selectedCard.node.xpSize && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-gray-500/10 text-muted font-medium">
                    {selectedCard.node.xpSize}
                  </span>
                )}
                {selectedCard.isNext && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-white font-bold">
                    NEXT
                  </span>
                )}
              </div>

              {/* Epic + Sprint bar */}
              {(selectedCard.epicTitle || selectedCard.node.sprint) && (
                <div className="flex flex-col gap-1 mb-3 p-2 rounded-lg bg-surface-alt border border-edge">
                  {selectedCard.epicTitle && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Tag className="w-3 h-3 text-purple-400 flex-shrink-0" />
                      <span className="text-muted text-[10px]">Epic:</span>
                      <span className="text-purple-400 truncate font-medium">{selectedCard.epicTitle}</span>
                    </div>
                  )}
                  {selectedCard.node.sprint && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Clock className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      <span className="text-muted text-[10px]">Sprint:</span>
                      <span className="text-blue-400 font-medium">{selectedCard.node.sprint}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Blockers + Deps warnings */}
              {(selectedCard.blockerCount > 0 || selectedCard.dependencyCount > 0) && (
                <div className="flex gap-2 mb-3">
                  {selectedCard.blockerCount > 0 && (
                    <div className="flex-1 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                      <div className="text-lg font-bold text-red-400">{selectedCard.blockerCount}</div>
                      <div className="text-[9px] text-red-400/80 uppercase">Blockers</div>
                    </div>
                  )}
                  {selectedCard.dependencyCount > 0 && (
                    <div className="flex-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                      <div className="text-lg font-bold text-amber-400">{selectedCard.dependencyCount}</div>
                      <div className="text-[9px] text-amber-400/80 uppercase">Dependencies</div>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {selectedCard.node.description && (
                <div className="mb-3">
                  <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Description</h4>
                  <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {selectedCard.node.description}
                  </p>
                </div>
              )}

              {/* Acceptance Criteria */}
              {selectedCard.node.acceptanceCriteria && selectedCard.node.acceptanceCriteria.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
                    Acceptance Criteria ({selectedCard.node.acceptanceCriteria.length})
                  </h4>
                  <ul className="space-y-1.5">
                    {selectedCard.node.acceptanceCriteria.map((ac, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground/80 p-1.5 rounded bg-surface-alt">
                        <span className="text-accent font-bold mt-0.5 text-[10px]">{i + 1}</span>
                        <span className="leading-relaxed">{ac}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Metadata grid */}
              <div className="space-y-2 mb-3">
                <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider">Details</h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <span className="text-muted">ID</span>
                  <span className="font-mono text-foreground/70 truncate" title={selectedCard.node.id}>
                    {selectedCard.node.id.slice(0, 16)}...
                  </span>

                  {selectedCard.node.estimateMinutes != null && (
                    <>
                      <span className="text-muted">Estimate</span>
                      <span className="text-foreground/80">{selectedCard.node.estimateMinutes}min</span>
                    </>
                  )}

                  <span className="text-muted">Created</span>
                  <span className="text-foreground/70">{new Date(selectedCard.node.createdAt).toLocaleDateString()}</span>

                  <span className="text-muted">Updated</span>
                  <span className="text-foreground/70">{new Date(selectedCard.node.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Tags */}
              {selectedCard.node.tags && selectedCard.node.tags.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedCard.node.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
