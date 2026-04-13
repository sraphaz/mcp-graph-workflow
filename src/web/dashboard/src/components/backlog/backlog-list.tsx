import { memo, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { GraphDocument, GraphNode } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/constants";

interface FlatBacklogItem {
  type: "next" | "group-header" | "task";
  key: string;
  parentId?: string;
  label?: string;
  doneCount?: number;
  totalCount?: number;
  pct?: number;
  task?: GraphNode;
  isNext?: boolean;
  depNames?: string[];
  color?: string;
}

interface BacklogListProps {
  graph: GraphDocument;
  onNodeClick: (node: GraphNode) => void;
}

export const BacklogList = memo(function BacklogList({ graph, onNodeClick }: BacklogListProps) {
  const { groups, nextTask, nodeMap } = useMemo(() => {
    const tasks = graph.nodes.filter((n) => n.type === "task" || n.type === "subtask");
    const nMap = new Map(graph.nodes.map((n) => [n.id, n]));
    const doneIds = new Set(graph.nodes.filter((n) => n.status === "done").map((n) => n.id));

    // Find next task
    const unblocked = tasks.filter((t) => {
      if (t.status !== "backlog" && t.status !== "ready") return false;
      if (t.blocked) return false;
      const deps = graph.edges.filter((e) => e.from === t.id && e.relationType === "depends_on");
      return deps.every((e) => doneIds.has(e.to));
    });
    unblocked.sort((a, b) => a.priority - b.priority);

    // Group by parent
    const byParent = new Map<string, GraphNode[]>();
    for (const task of tasks) {
      const key = task.parentId || "__root__";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(task);
    }
    for (const group of byParent.values()) {
      group.sort((a, b) => a.priority - b.priority);
    }

    return { groups: byParent, nextTask: unblocked[0] || null, nodeMap: nMap };
  }, [graph]);

  // Flatten all items into a single virtual list
  const flatItems = useMemo(() => {
    const items: FlatBacklogItem[] = [];

    if (nextTask) {
      items.push({ type: "next", key: "next", task: nextTask });
    }

    for (const [parentId, tasks] of groups.entries()) {
      const parent = parentId !== "__root__" ? nodeMap.get(parentId) : null;
      const label = parent ? parent.title : "Ungrouped Tasks";
      const doneCount = tasks.filter((t) => t.status === "done").length;
      const pct = Math.round((doneCount / tasks.length) * 100);

      items.push({
        type: "group-header",
        key: `header-${parentId}`,
        parentId,
        label,
        doneCount,
        totalCount: tasks.length,
        pct,
      });

      for (const task of tasks) {
        const isNext = nextTask?.id === task.id;
        const color = STATUS_COLORS[task.status] || "#9e9e9e";
        const deps = graph.edges.filter((e) => e.from === task.id && e.relationType === "depends_on");
        const depNames = deps.map((e) => nodeMap.get(e.to)?.title || e.to);

        items.push({
          type: "task",
          key: task.id,
          task,
          isNext,
          color,
          depNames,
        });
      }
    }

    return items;
  }, [groups, nextTask, nodeMap, graph.edges]);

  const hasTasks = graph.nodes.some((n) => n.type === "task" || n.type === "subtask");

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flatItems[index];
      if (item.type === "next") return 48;
      if (item.type === "group-header") return 40;
      return item.depNames && item.depNames.length > 0 ? 44 : 32;
    },
    overscan: 10,
  });

  if (!hasTasks) {
    return (
      <div className="p-4 text-center text-muted">
        No tasks in backlog.
      </div>
    );
  }

  return (
    <div ref={parentRef} className="p-2 overflow-y-auto h-full">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = flatItems[virtualRow.index];

          if (item.type === "next" && item.task) {
            return (
              <div
                key={item.key}
                className="absolute top-0 left-0 w-full px-3 py-2 bg-accent10 border border-accent rounded-lg"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <span className="text-xs font-medium text-accent">Next:</span>{" "}
                <span className="text-sm font-semibold">{item.task.title}</span>
              </div>
            );
          }

          if (item.type === "group-header") {
            return (
              <div
                key={item.key}
                className="absolute top-0 left-0 w-full"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="flex items-center justify-between px-2 py-1 mt-2">
                  <h4 className="text-xs font-semibold truncate">{item.label}</h4>
                  <span className="text-[10px] text-muted">{item.doneCount}/{item.totalCount}</span>
                </div>
                <div className="h-1 mx-2 mb-1 bg-surface-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${item.pct}%`, background: STATUS_COLORS.done }}
                  />
                </div>
              </div>
            );
          }

          if (item.type === "task" && item.task) {
            return (
              <div
                key={item.key}
                onClick={() => onNodeClick(item.task!)}
                className={`absolute top-0 left-0 w-full mx-1 px-2 py-1.5 rounded cursor-pointer hover:bg-surface-elevated transition-colors ${
                  item.isNext ? "ring-1 ring-accent" : ""
                }`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  width: "calc(100% - 8px)",
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[9px] px-1 py-0.5 rounded font-medium shrink-0"
                    style={{ background: `${item.color}20`, color: item.color }}
                  >
                    {item.task.status.replace("_", " ")}
                  </span>
                  <span className="text-xs truncate flex-1">{item.task.title}</span>
                  <span className="text-[10px] text-muted">P{item.task.priority}</span>
                  {item.task.xpSize && (
                    <span className="text-[10px] text-muted">{item.task.xpSize}</span>
                  )}
                </div>
                {item.depNames && item.depNames.length > 0 && (
                  <div className="text-[10px] text-muted mt-0.5 truncate pl-1">
                    Depends on: {item.depNames.join(", ")}
                  </div>
                )}
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
});
