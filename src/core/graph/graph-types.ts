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

export type NodeType =
  | "epic"
  | "task"
  | "subtask"
  | "requirement"
  | "constraint"
  | "milestone"
  | "acceptance_criteria"
  | "risk"
  | "decision"
  // Game-specific / advanced node types
  | "interface"
  | "formula"
  | "state_machine"
  | "contract"
  | "scenario"
  | "performance_budget"
  | "asset"
  | "data_table"
  | "metric"
  | "config_schema"
  // Spec-driven development types
  | "constitution"
  // Journey execution
  | "journey_run";

export type NodeStatus =
  | "backlog"
  | "ready"
  | "in_progress"
  | "blocked"
  | "done";

export type XpSize = "XS" | "S" | "M" | "L" | "XL";

export type RelationType =
  | "parent_of"
  | "child_of"
  | "depends_on"
  | "blocks"
  | "related_to"
  | "priority_over"
  | "implements"
  | "derived_from"
  // Game-specific / advanced relation types
  | "provides"
  | "consumes"
  | "requires_asset";

export interface SourceRef {
  file: string;
  startLine?: number;
  endLine?: number;
  confidence?: number;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  status: NodeStatus;
  priority: 1 | 2 | 3 | 4 | 5;
  xpSize?: XpSize;
  estimateMinutes?: number;
  tags?: string[];
  parentId?: string | null;
  sprint?: string | null;
  sourceRef?: SourceRef;
  acceptanceCriteria?: string[];
  testFiles?: string[];
  blocked?: boolean;
  metadata?: {
    inferred?: boolean;
    origin?: string;
    [key: string]: unknown;
  };
  /**
   * §extracta — Why this node was last regenerated. Null/undefined for
   * nodes that have never been regenerated. Set by `node update` when the
   * caller passes `evolutionReason`. Drives analyze(evolution_audit).
   */
  evolutionReason?: string | null;
  /**
   * §extracta — Cumulative count of regenerations. Incremented every time
   * `node update` is called with a non-null `evolutionReason`.
   */
  evolutionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relationType: RelationType;
  weight?: number;
  reason?: string;
  metadata?: {
    inferred?: boolean;
    confidence?: number;
    [key: string]: unknown;
  };
  createdAt: string;
}

export interface GraphIndexes {
  byId: Record<string, number>;
  childrenByParent: Record<string, string[]>;
  incomingByNode: Record<string, string[]>;
  outgoingByNode: Record<string, string[]>;
}

export interface GraphProject {
  id: string;
  name: string;
  fsPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraphMeta {
  sourceFiles: string[];
  lastImport: string | null;
}

export interface GraphDocument {
  version: string;
  project: GraphProject;
  nodes: GraphNode[];
  edges: GraphEdge[];
  indexes: GraphIndexes;
  meta: GraphMeta;
}
