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

import { useRef } from "react";
import { Loader2, FileUp, AlertCircle, LayoutGrid } from "lucide-react";
import type { GraphDocument } from "@/lib/types";
import { WorkflowGraph } from "@/components/graph/workflow-graph";
import { FullscreenButton } from "../ui/fullscreen-button";
import { FullscreenOverlay } from "../ui/fullscreen-overlay";

interface GraphTabProps {
  graph: GraphDocument | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onImportPrd?: () => void;
}

function GraphSkeleton(): React.JSX.Element {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping" />
        <Loader2 className="w-8 h-8 text-accent animate-spin relative" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Loading graph...</p>
        <p className="text-[10px] text-muted mt-1">Computing layout and rendering nodes</p>
      </div>
    </div>
  );
}

function GraphError({ message, onRetry }: { message: string; onRetry?: () => void }): React.JSX.Element {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <AlertCircle className="w-10 h-10 text-red-400" />
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Failed to load graph</p>
        <p className="text-xs text-muted mt-1 max-w-md">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md border border-edge text-muted hover:text-foreground hover:border-accent/50 transition-colors cursor-pointer"
        >
          <Loader2 className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}

function GraphEmpty({ onImportPrd }: { onImportPrd?: () => void }): React.JSX.Element {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <LayoutGrid className="w-12 h-12 text-muted/30" />
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">No nodes in the graph</p>
        <p className="text-xs text-muted mt-1">Import a PRD or add nodes to get started</p>
      </div>
      {onImportPrd && (
        <button
          onClick={onImportPrd}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-accent text-white hover:opacity-90 transition-opacity cursor-pointer"
        >
          <FileUp className="w-3.5 h-3.5" />
          Import PRD
        </button>
      )}
    </div>
  );
}

export function GraphTab({ graph, loading, error, onRetry, onImportPrd }: GraphTabProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  if (loading && !graph) {
    return <GraphSkeleton />;
  }

  if (error && !graph) {
    return <GraphError message={error} onRetry={onRetry} />;
  }

  if (!graph || (graph.nodes.length === 0 && graph.edges.length === 0)) {
    return <GraphEmpty onImportPrd={onImportPrd} />;
  }

  return (
    <div ref={containerRef} className="relative h-full">
      <div className="absolute top-2 right-2 z-10">
        <FullscreenButton containerRef={containerRef} tabName="Graph" />
      </div>
      <FullscreenOverlay tabName="Graph" />
      <WorkflowGraph graph={graph} />
    </div>
  );
}
