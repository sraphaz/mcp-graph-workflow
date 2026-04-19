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

import { useState, useCallback, useMemo, useRef } from "react";
import { FullscreenButton } from "../ui/fullscreen-button";
import { FullscreenOverlay } from "../ui/fullscreen-overlay";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { GraphDocument, GraphNode } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/constants";
import { buildChildrenMap, getVisibleNodes } from "@/lib/graph-hierarchy";
import { WorkflowNode } from "@/components/graph/workflow-node";
import { WorkflowEdge } from "@/components/graph/workflow-edge";
import { NodeDetailDrawer } from "@/components/graph/node-detail-drawer";
import { toFlowNodes, toFlowEdges, applyDagreLayout, type WorkflowNodeData, type WorkflowEdgeData } from "@/components/graph/graph-utils";
import { BacklogList } from "@/components/backlog/backlog-list";
import { useEffect } from "react";

const nodeTypes = { workflowNode: WorkflowNode };
const edgeTypes = { workflowEdge: WorkflowEdge };
const proOptions = { hideAttribution: true };

interface PrdBacklogTabProps {
  graph: GraphDocument | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function PrdBacklogFlow({ graph }: { graph: GraphDocument }): React.JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<WorkflowEdgeData>>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const isInitialRender = useRef(true);
  const { fitView } = useReactFlow();

  const childrenMap = useMemo(
    () => buildChildrenMap(graph.nodes, graph.edges),
    [graph.nodes, graph.edges],
  );

  const handleNodeExpand = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const visibleGraphNodes = getVisibleNodes(graph.nodes, expandedIds, childrenMap);
    const flowNodes = toFlowNodes(visibleGraphNodes, undefined, childrenMap, expandedIds, handleNodeExpand);
    const visibleIds = new Set(flowNodes.map((n) => n.id));
    const flowEdges = toFlowEdges(graph.edges, visibleIds);
    const layout = applyDagreLayout(flowNodes, flowEdges, "TB");
    setNodes(layout.nodes);
    setEdges(layout.edges);

    // Auto-fitView after expand/collapse (skip initial render — fitView prop handles that)
    if (isInitialRender.current) {
      isInitialRender.current = false;
    } else {
      // Wait for ReactFlow to process the new nodes before fitting
      setTimeout(() => fitView({ duration: 300 }), 50);
    }
  }, [graph, setNodes, setEdges, expandedIds, childrenMap, handleNodeExpand, fitView]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<WorkflowNodeData>) => {
      setSelectedNode(node.data.sourceNode);
    },
    [],
  );

  const handleBacklogClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
  }, []);

  const handleNodeNavigate = useCallback((nodeId: string) => {
    const target = graph.nodes.find((n) => n.id === nodeId);
    if (target) setSelectedNode(target);
    // Center the graph on the target node
    const flowNode = nodes.find((n) => n.id === nodeId);
    if (flowNode && flowNode.position) {
      fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 0.5 });
    }
  }, [graph.nodes, nodes, fitView]);

  // Progress stats
  const stats = useMemo(() => {
    const total = graph.nodes.length;
    const done = graph.nodes.filter((n) => n.status === "done").length;
    const inProgress = graph.nodes.filter((n) => n.status === "in_progress").length;
    const blocked = graph.nodes.filter((n) => n.status === "blocked").length;
    return { total, done, inProgress, blocked, pctDone: total ? Math.round((done / total) * 100) : 0 };
  }, [graph.nodes]);

  return (
    <div className="flex h-full">
      {/* Left: Workflow diagram */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-3 py-1.5 bg-surface-alt border-b border-edge flex items-center gap-2 text-xs relative z-10">
          <span className="text-muted">
            Showing {nodes.length} of {graph.nodes.length} nodes — click ▶ to expand
          </span>
        </div>
        {graph.nodes.length > 0 ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            onlyRenderVisibleElements
            fitView
            minZoom={0.1}
            maxZoom={2}
            proOptions={proOptions}
          >
            <Background gap={16} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        ) : (
          <div className="flex items-center justify-center h-full text-muted">
            Import a PRD to see the workflow
          </div>
        )}
      </div>

      {/* Right: Backlog list */}
      <div className="w-[480px] border-l border-edge flex flex-col overflow-hidden">
        {/* Progress bar */}
        <div className="px-4 py-3 border-b border-edge bg-surface-alt">
          <div className="flex justify-between text-sm mb-1">
            <span>{stats.done}/{stats.total} done ({stats.pctDone}%)</span>
            <span className="text-muted">
              {stats.inProgress} in progress, {stats.blocked} blocked
            </span>
          </div>
          <div className="h-2 bg-surface-elevated rounded-full overflow-hidden flex">
            <div
              className="h-full transition-all"
              style={{ width: `${stats.pctDone}%`, background: STATUS_COLORS.done }}
            />
            <div
              className="h-full transition-all"
              style={{
                width: `${stats.total ? Math.round((stats.inProgress / stats.total) * 100) : 0}%`,
                background: STATUS_COLORS.in_progress,
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <BacklogList graph={graph} onNodeClick={handleBacklogClick} />
        </div>
      </div>

      {/* Detail drawer */}
      <NodeDetailDrawer
        node={selectedNode}
        edges={graph.edges}
        allNodes={graph.nodes}
        childrenMap={childrenMap}
        onClose={() => setSelectedNode(null)}
        onNodeNavigate={handleNodeNavigate}
      />
    </div>
  );
}

export function PrdBacklogTab({ graph, loading, error, onRetry }: PrdBacklogTabProps): React.JSX.Element {
  if (loading || !graph) {
    return (
      <div className="flex h-full">
        {/* Left: Canvas skeleton */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="px-3 py-1.5 bg-surface-alt border-b border-edge">
            <div className="h-3 w-48 rounded bg-surface animate-pulse" />
          </div>
          <div className="flex-1 bg-surface-alt animate-pulse" />
        </div>
        {/* Right: Sidebar skeleton */}
        <div className="w-[480px] border-l border-edge flex flex-col">
          <div className="px-4 py-3 border-b border-edge bg-surface-alt space-y-2">
            <div className="flex justify-between">
              <div className="h-4 w-28 rounded bg-surface animate-pulse" />
              <div className="h-4 w-40 rounded bg-surface animate-pulse" />
            </div>
            <div className="h-2 rounded-full bg-surface animate-pulse" />
          </div>
          <div className="flex-1 p-3 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg border border-edge bg-surface-alt animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Failed to load PRD & Backlog</p>
          <p className="text-xs text-muted mt-1">{error}</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md border border-edge text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
        <p className="text-xs">No graph data available</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="text-xs px-3 py-1.5 rounded border border-edge hover:text-foreground transition-colors cursor-pointer">
            Retry
          </button>
        )}
      </div>
    );
  }

  const fsContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={fsContainerRef} className="relative h-full">
      <div className="absolute top-2 right-2 z-10">
        <FullscreenButton containerRef={fsContainerRef} tabName="PRD & Backlog" />
      </div>
      <FullscreenOverlay tabName="PRD & Backlog" />
      <ReactFlowProvider>
        <PrdBacklogFlow graph={graph} />
      </ReactFlowProvider>
    </div>
  );
}
