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

/**
 * SiebelEdge — Custom React Flow edge with relation type label.
 */

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { SiebelEdgeData } from "./siebel-graph-utils";

type SiebelEdgeProps = EdgeProps & { data?: SiebelEdgeData };

export const SiebelEdge = memo(function SiebelEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: SiebelEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      {data?.relationType && (
        <EdgeLabelRenderer>
          <div
            className="absolute text-[9px] px-1 py-0.5 rounded bg-surface border border-edge text-muted pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {data.relationType.replace(/_/g, " ")}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
