import { memo } from "react";
import type { KanbanCard as KanbanCardType } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/constants";

interface KanbanCardProps {
  card: KanbanCardType;
  onDragStart: (e: React.DragEvent, nodeId: string) => void;
  onClick?: (nodeId: string) => void;
}

export const KanbanCard = memo(function KanbanCard({ card, onDragStart, onClick }: KanbanCardProps) {
  const { node, blockerCount, dependencyCount, isNext, epicTitle } = card;
  const statusColor = STATUS_COLORS[node.status] || "#9e9e9e";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, node.id)}
      onClick={() => onClick?.(node.id)}
      className={`
        p-2.5 mb-2 rounded-lg border cursor-grab active:cursor-grabbing
        bg-surface-alt hover:bg-surface-elevated transition-colors
        ${isNext ? "ring-2 ring-accent border-accent" : "border-edge"}
      `}
    >
      {/* Top row: badges */}
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
      </div>

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
