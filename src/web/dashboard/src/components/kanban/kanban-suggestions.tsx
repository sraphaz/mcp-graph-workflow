import { memo } from "react";
import type { KanbanSuggestion } from "@/lib/types";
import { ArrowRight, AlertTriangle, Zap } from "lucide-react";

interface KanbanSuggestionsProps {
  suggestions: KanbanSuggestion[];
  onApply: (suggestion: KanbanSuggestion) => void;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  promote_ready: <ArrowRight className="w-3 h-3 text-green-400" />,
  unblock: <Zap className="w-3 h-3 text-blue-400" />,
  wip_violation: <AlertTriangle className="w-3 h-3 text-red-400" />,
  bottleneck_alert: <AlertTriangle className="w-3 h-3 text-orange-400" />,
  start_next: <ArrowRight className="w-3 h-3 text-accent" />,
};

const ACTION_LABELS: Record<string, string> = {
  promote_ready: "Promote to Ready",
  unblock: "Unblock Task",
  wip_violation: "WIP Violation",
  bottleneck_alert: "Bottleneck Alert",
  start_next: "Start Next Task",
};

export const KanbanSuggestions = memo(function KanbanSuggestions({
  suggestions,
  onApply,
}: KanbanSuggestionsProps) {
  if (suggestions.length === 0) {
    return (
      <div className="p-4 text-center text-[10px] text-muted">
        No suggestions — board looks healthy!
      </div>
    );
  }

  return (
    <div className="w-64 border-l border-edge bg-surface-alt overflow-y-auto">
      <div className="px-3 py-2 border-b border-edge">
        <h3 className="text-xs font-semibold text-foreground">Suggestions</h3>
      </div>
      <div className="p-2 space-y-2">
        {suggestions.map((s, i) => (
          <div
            key={`${s.action}-${s.nodeId}-${i}`}
            className="p-2 rounded-lg border border-edge bg-surface hover:bg-surface-elevated transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-1">
              {ACTION_ICONS[s.action] ?? <Zap className="w-3 h-3 text-muted" />}
              <span className="text-[10px] font-semibold text-foreground">
                {ACTION_LABELS[s.action] ?? s.action}
              </span>
            </div>
            {s.nodeTitle && (
              <p className="text-[10px] font-medium text-foreground mb-0.5 truncate">
                {s.nodeTitle}
              </p>
            )}
            <p className="text-[9px] text-muted leading-snug mb-1.5">{s.reason}</p>
            {s.nodeId && (s.action === "promote_ready" || s.action === "unblock" || s.action === "start_next") && (
              <button
                onClick={() => onApply(s)}
                className="text-[9px] px-2 py-1 rounded bg-accent text-white hover:opacity-90 transition-opacity"
              >
                Apply
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
