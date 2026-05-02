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

import { useState, useCallback, useMemo, useEffect, useDeferredValue, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { GraphDocument, GraphNode, NodeStatus, NodeType } from "@/lib/types";
import { buildChildrenMap, getVisibleNodes, buildHierarchyTree } from "@/lib/graph-hierarchy";
import { WorkflowNode } from "./workflow-node";
import { WorkflowEdge } from "./workflow-edge";
import { FilterPanel } from "./filter-panel";
import { HierarchyTreePanel } from "./hierarchy-tree-panel";
import { NodeDetailDrawer } from "./node-detail-drawer";
import { NodeTable } from "./node-table";
import { EdgeCreateDialog } from "./edge-create-dialog";
import { toFlowNodes, toFlowEdges, applyDagreLayout, shouldSkipLayout, type WorkflowNodeData, type WorkflowEdgeData } from "./graph-utils";

const nodeTypes = { workflowNode: WorkflowNode };
const edgeTypes = { workflowEdge: WorkflowEdge };
const proOptions = { hideAttribution: true };

interface WorkflowGraphProps {
  graph: GraphDocument;
}

interface PendingConnection {
  fromId: string;
  toId: string;
}

/** WorkflowGraph — auto-generated description placeholder. */
export function WorkflowGraph({ graph }: WorkflowGraphProps): React.JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<WorkflowEdgeData>>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [direction, setDirection] = useState<"TB" | "LR">("TB");
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set());
  const [filterSprints, setFilterSprints] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);

  // Defer filter values so checkbox updates are visually immediate
  const deferredStatuses = useDeferredValue(filterStatuses);
  const deferredTypes = useDeferredValue(filterTypes);
  const deferredSprints = useDeferredValue(filterSprints);
  const deferredDirection = useDeferredValue(direction);

  // Track previous layout node IDs to skip redundant Dagre runs
  const prevLayoutIdsRef = useRef<string[] | null>(null);

  // Compute children map once per graph change
  const childrenMap = useMemo(
    () => buildChildrenMap(graph.nodes, graph.edges),
    [graph.nodes, graph.edges],
  );

  // Hierarchy tree for sidebar
  const hierarchyTree = useMemo(
    () => buildHierarchyTree(graph.nodes, childrenMap),
    [graph.nodes, childrenMap],
  );

  // Expand/collapse handlers
  const handleNodeExpand = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const allParentIds = new Set<string>();
    for (const [parentId] of childrenMap) {
      allParentIds.add(parentId);
    }
    setExpandedIds(allParentIds);
  }, [childrenMap]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const applyLayout = useCallback(
    (statuses: Set<string>, types: Set<string>, sprints: Set<string>, dir: "TB" | "LR") => {
      const visibleGraphNodes = getVisibleNodes(graph.nodes, expandedIds, childrenMap);
      const filters = { statuses, types, sprints };
      const flowNodes = toFlowNodes(visibleGraphNodes, filters, childrenMap, expandedIds, handleNodeExpand);
      const nextIds = flowNodes.map((n) => n.id);

      // Skip Dagre if visible node IDs haven't changed
      if (shouldSkipLayout(prevLayoutIdsRef.current, nextIds) && dir === deferredDirection) {
        return;
      }
      prevLayoutIdsRef.current = nextIds;

      const visibleIds = new Set(nextIds);
      const flowEdges = toFlowEdges(graph.edges, visibleIds);
      const layout = applyDagreLayout(flowNodes, flowEdges, dir);
      setNodes(layout.nodes);
      setEdges(layout.edges);
    },
    [graph, setNodes, setEdges, deferredDirection, expandedIds, childrenMap, handleNodeExpand],
  );

  useEffect(() => {
    applyLayout(deferredStatuses, deferredTypes, deferredSprints, deferredDirection);
  }, [graph, applyLayout, deferredStatuses, deferredTypes, deferredSprints, deferredDirection]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<WorkflowNodeData>) => {
      setSelectedNode(node.data.sourceNode);
    },
    [],
  );

  const handleTableNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
  }, []);

  const handleNodeNavigate = useCallback(
    (nodeId: string) => {
      const target = graph.nodes.find((n) => n.id === nodeId);
      if (target) setSelectedNode(target);
    },
    [graph.nodes],
  );

  const handleTreeSelectNode = useCallback(
    (nodeId: string) => {
      const target = graph.nodes.find((n) => n.id === nodeId);
      if (target) setSelectedNode(target);
    },
    [graph.nodes],
  );

  const handleConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target && connection.source !== connection.target) {
      setPendingConnection({ fromId: connection.source, toId: connection.target });
    }
  }, []);

  const handleEdgeCreated = useCallback(() => {
    setPendingConnection(null);
    // SSE will trigger a graph refresh automatically
  }, []);

  const toggleStatus = useCallback((status: NodeStatus) => {
    setFilterStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  const toggleType = useCallback((type: NodeType) => {
    setFilterTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleSprint = useCallback((sprint: string) => {
    setFilterSprints((prev) => {
      const next = new Set(prev);
      if (next.has(sprint)) next.delete(sprint);
      else next.add(sprint);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilterStatuses(new Set());
    setFilterTypes(new Set());
    setFilterSprints(new Set());
  }, []);

  // Available sprints for filter dropdown
  const availableSprints = useMemo(() => {
    const sprints = new Set<string>();
    for (const n of graph.nodes) {
      if (n.sprint) sprints.add(n.sprint);
    }
    return [...sprints].sort();
  }, [graph.nodes]);

  // Visible nodes for the table (respects expansion + filters)
  const visibleTableNodes = useMemo(() => {
    const visible = getVisibleNodes(graph.nodes, expandedIds, childrenMap);
    return visible.filter((n) => {
      if (filterStatuses.size && !filterStatuses.has(n.status)) return false;
      if (filterTypes.size && !filterTypes.has(n.type)) return false;
      if (filterSprints.size && !filterSprints.has(n.sprint ?? "")) return false;
      return true;
    });
  }, [graph.nodes, expandedIds, childrenMap, filterStatuses, filterTypes]);

  // Resolve titles for pending connection dialog
  const pendingFromTitle = pendingConnection
    ? graph.nodes.find((n) => n.id === pendingConnection.fromId)?.title
    : undefined;
  const pendingToTitle = pendingConnection
    ? graph.nodes.find((n) => n.id === pendingConnection.toId)?.title
    : undefined;

  return (
    <div className="flex flex-col h-full">
      <FilterPanel
        statuses={filterStatuses}
        types={filterTypes}
        sprints={filterSprints}
        availableSprints={availableSprints}
        direction={direction}
        onStatusToggle={toggleStatus}
        onTypeToggle={toggleType}
        onSprintToggle={toggleSprint}
        onDirectionChange={setDirection}
        onClear={clearFilters}
        visibleNodeCount={visibleTableNodes.length}
        totalNodeCount={graph.nodes.length}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
      />

      <div className="flex flex-1 min-h-0">
        <HierarchyTreePanel
          tree={hierarchyTree}
          expandedIds={expandedIds}
          selectedNodeId={selectedNode?.id ?? null}
          onToggleExpand={handleNodeExpand}
          onSelectNode={handleTreeSelectNode}
        />

        <div className="flex-1 relative">
          {graph.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted">
              <div className="text-center">
                <p className="text-lg mb-2">No nodes in graph</p>
                <p className="text-sm">Import a PRD to get started</p>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              onConnect={handleConnect}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              nodesDraggable={false}
              nodesConnectable={true}
              onlyRenderVisibleElements
              fitView
              minZoom={0.1}
              maxZoom={2}
              proOptions={proOptions}
            >
              <Background gap={16} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}
        </div>

        <NodeDetailDrawer
          node={selectedNode}
          edges={graph.edges}
          allNodes={graph.nodes}
          childrenMap={childrenMap}
          onClose={() => setSelectedNode(null)}
          onNodeNavigate={handleNodeNavigate}
        />
      </div>

      <NodeTable nodes={visibleTableNodes} allNodes={graph.nodes} onNodeClick={handleTableNodeClick} />

      {pendingConnection && (
        <EdgeCreateDialog
          fromId={pendingConnection.fromId}
          toId={pendingConnection.toId}
          fromTitle={pendingFromTitle}
          toTitle={pendingToTitle}
          onCreated={handleEdgeCreated}
          onCancel={() => setPendingConnection(null)}
        />
      )}
    </div>
  );
}
