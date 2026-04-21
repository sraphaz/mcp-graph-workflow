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

export class McpGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpGraphError";
  }
}

export class FileNotFoundError extends McpGraphError {
  constructor(path: string) {
    super(`File not found: ${path}`);
    this.name = "FileNotFoundError";
  }
}

export class GraphNotInitializedError extends McpGraphError {
  constructor() {
    super("Graph not initialized. Run 'mcp-graph init' first.");
    this.name = "GraphNotInitializedError";
  }
}

export class NodeNotFoundError extends McpGraphError {
  constructor(id: string) {
    super(`Node not found: ${id}`);
    this.name = "NodeNotFoundError";
  }
}

export class ValidationError extends McpGraphError {
  constructor(message: string, public readonly issues: unknown[]) {
    super(`Validation failed: ${message}`);
    this.name = "ValidationError";
  }
}

export class SnapshotNotFoundError extends McpGraphError {
  constructor(id: number) {
    super(`Snapshot not found: ${id}`);
    this.name = "SnapshotNotFoundError";
  }
}

/** Safely extract an error message from an unknown thrown value. */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── Translation errors ──

export class TranslationError extends McpGraphError {
  constructor(message: string) {
    super(`Translation error: ${message}`);
    this.name = "TranslationError";
  }
}

export class UnsupportedLanguagePairError extends McpGraphError {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Unsupported language pair: ${from} → ${to}`);
    this.name = "UnsupportedLanguagePairError";
  }
}

export class TranslationValidationError extends McpGraphError {
  constructor(
    public readonly jobId: string,
    message: string,
  ) {
    super(`Translation validation failed for job ${jobId}: ${message}`);
    this.name = "TranslationValidationError";
  }
}

// ── ONNX errors ──

export class OnnxModelNotFoundError extends McpGraphError {
  constructor(public readonly modelPath: string) {
    super(`ONNX model not found at: ${modelPath}. Run 'npm run model:download' or ensure internet access for first-time download.`);
    this.name = "OnnxModelNotFoundError";
  }
}

// ── Multi-agent errors ──

export interface ConflictDetails {
  currentVersion: number;
  expectedVersion: number;
  modifiedBy: string | null;
  modifiedAt: string | null;
}

export class ConflictError extends McpGraphError {
  constructor(public readonly details: ConflictDetails) {
    super(`Optimistic lock conflict: expected version ${details.expectedVersion}, found ${details.currentVersion} (modified by ${details.modifiedBy ?? 'unknown'})`);
    this.name = "ConflictError";
  }
}

export interface LockConflictDetails {
  resourceId: string;
  owner: string;
  acquiredAt: string;
  expiresAt: string;
}

export class LockConflictError extends McpGraphError {
  constructor(public readonly details: LockConflictDetails) {
    super(`Resource "${details.resourceId}" is locked by agent "${details.owner}" until ${details.expiresAt}`);
    this.name = "LockConflictError";
  }
}

export interface WIPLimitDetails {
  current: number;
  limit: number;
  inFlightNodeIds: string[];
}

export class WIPLimitError extends McpGraphError {
  constructor(public readonly details: WIPLimitDetails) {
    super(`WIP limit reached: ${details.current}/${details.limit} tasks in flight (${details.inFlightNodeIds.join(", ")})`);
    this.name = "WIPLimitError";
  }
}

export interface FileConflictHolder {
  nodeId: string;
  agentId: string;
}

export interface FileConflictDetails {
  nodeId: string;
  conflictingFiles: string[];
  heldBy: FileConflictHolder[];
}

export class FileConflictError extends McpGraphError {
  constructor(public readonly details: FileConflictDetails) {
    super(`File conflict for "${details.nodeId}": ${details.conflictingFiles.length} file(s) already claimed`);
    this.name = "FileConflictError";
  }
}

// ── Planner errors ──

export class PlannerError extends McpGraphError {
  constructor(message: string) {
    super(`Planner error: ${message}`);
    this.name = "PlannerError";
  }
}

// ── Graph integrity errors ──

export class GraphIntegrityError extends McpGraphError {
  constructor(message: string) {
    super(`Graph integrity error: ${message}`);
    this.name = "GraphIntegrityError";
  }
}

// ── Context errors ──

export class ContextBuildError extends McpGraphError {
  constructor(message: string) {
    super(`Context build error: ${message}`);
    this.name = "ContextBuildError";
  }
}

// ── Deploy errors ──

export class DeployReadinessError extends McpGraphError {
  constructor(message: string) {
    super(`Deploy readiness error: ${message}`);
    this.name = "DeployReadinessError";
  }
}

// ── Lifecycle errors ──

export class LifecycleGateError extends McpGraphError {
  constructor(
    public readonly toolName: string,
    public readonly currentPhase: string,
    public readonly reason: string,
    public readonly unmetConditions: string[],
  ) {
    super(`Lifecycle gate: "${toolName}" blocked in ${currentPhase} — ${reason}`);
    this.name = "LifecycleGateError";
  }
}
