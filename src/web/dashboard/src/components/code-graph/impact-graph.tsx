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

import { useMemo } from "react";
import { ReactFlow, Background, type Node, type Edge } from "@xyflow/react";
import type { ImpactResult } from "@/lib/types";

interface ImpactGraphProps {
  impact: ImpactResult;
  className?: string;
}

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "#22c55e";
  if (confidence >= 0.5) return "#f59e0b";
  return "#ef4444";
}

/** ImpactGraph — auto-generated description placeholder. */
export function ImpactGraph({ impact, className }: ImpactGraphProps): React.JSX.Element {
  const { nodes, edges } = useMemo(() => {
    const riskColor = RISK_COLORS[impact.riskLevel] ?? "#6b7280";
    const affected = impact.affectedSymbols;

    // Center node
    const centerNode: Node = {
      id: "center",
      position: { x: 300, y: 200 },
      data: { label: impact.symbol },
      style: {
        background: riskColor,
        color: "#fff",
        border: `2px solid ${riskColor}`,
        borderRadius: 12,
        padding: "8px 16px",
        fontSize: 13,
        fontWeight: 600,
      },
    };

    // Arrange affected symbols in a circle around center
    const radius = 180;
    const angleStep = affected.length > 0 ? (2 * Math.PI) / affected.length : 0;

    const affectedNodes: Node[] = affected.map((sym, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const x = 300 + radius * Math.cos(angle);
      const y = 200 + radius * Math.sin(angle);
      const color = confidenceColor(sym.confidence);

      return {
        id: `sym-${i}`,
        position: { x, y },
        data: {
          label: `${sym.name}\n${sym.file.split("/").pop() ?? sym.file}`,
        },
        style: {
          background: `${color}18`,
          color: "var(--color-text-primary, #e2e8f0)",
          border: `2px solid ${color}`,
          borderRadius: 10,
          padding: "6px 12px",
          fontSize: 11,
          whiteSpace: "pre-line" as const,
          textAlign: "center" as const,
          maxWidth: 160,
        },
      };
    });

    const resultEdges: Edge[] = affected.map((sym, i) => ({
      id: `edge-${i}`,
      source: "center",
      target: `sym-${i}`,
      style: {
        stroke: confidenceColor(sym.confidence),
        strokeWidth: Math.max(1, sym.confidence * 3),
      },
      animated: sym.confidence < 0.5,
    }));

    return { nodes: [centerNode, ...affectedNodes], edges: resultEdges };
  }, [impact]);

  if (impact.affectedSymbols.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted h-[300px] ${className ?? ""}`}>
        No affected symbols found
      </div>
    );
  }

  return (
    <div className={`h-[400px] rounded-xl border border-edge overflow-hidden ${className ?? ""}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-edge bg-surface-alt">
        <span className="text-xs font-semibold">Impact Graph</span>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{
            background: `${RISK_COLORS[impact.riskLevel] ?? "#6b7280"}20`,
            color: RISK_COLORS[impact.riskLevel] ?? "#6b7280",
          }}
        >
          {impact.riskLevel} risk
        </span>
        <span className="text-[10px] text-muted ml-auto">
          {impact.affectedSymbols.length} affected symbols
        </span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        minZoom={0.3}
        maxZoom={2}
      >
        <Background gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
