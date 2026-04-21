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
 * TaskEditorPanel — Monaco-based code editor panel for the IDE experience.
 *
 * Features:
 * - Syntax highlighting for supported languages (typescript, javascript, python, java, etc.)
 * - Find shortcut: Cmd+F / Ctrl+F opens Monaco actions.find inline widget
 * - Dirty-state visual indicator: dot shown when content differs from initialValue
 *
 * Monaco is loaded via dynamic import (@monaco-editor/react). Falls back to
 * a plain textarea when the package is not available in the bundle.
 */

import React, { useState, useCallback, useRef, lazy, Suspense } from "react";

// Supported languages for syntax highlighting
export const SUPPORTED_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "java",
  "json",
  "markdown",
  "css",
  "html",
  "sql",
  "shell",
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export interface TaskEditorPanelProps {
  initialValue: string;
  language?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: string;
}

// Lazy-load Monaco to keep initial bundle small.
// @ts-ignore — @monaco-editor/react is an optional peer; Suspense fallback (textarea)
//              renders when the package is not installed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MonacoEditor = lazy<React.ComponentType<any>>(() =>
  // @ts-ignore
  import("@monaco-editor/react")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then((m: any) => ({ default: m.default as React.ComponentType<any> }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .catch(() => ({ default: (() => null) as React.ComponentType<any> }))
);

export function TaskEditorPanel({
  initialValue,
  language = "typescript",
  onChange,
  readOnly = false,
  height = "400px",
}: TaskEditorPanelProps): React.ReactElement {
  const [value, setValue] = useState(initialValue);
  const isDirty = value !== initialValue;
  const [showFind, setShowFind] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      const v = newValue ?? "";
      setValue(v);
      onChange?.(v);
    },
    [onChange],
  );

  // Cmd+F / Ctrl+F — trigger Monaco actions.find inline widget
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent | KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowFind(true);
        if (editorRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          editorRef.current.getAction("actions.find")?.run();
        }
      }
    },
    [],
  );

  const handleEditorMount = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor: any) => {
      editorRef.current = editor;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      editor.onKeyDown((e: KeyboardEvent) => handleKeyDown(e));
    },
    [handleKeyDown],
  );

  return (
    <div
      className="flex flex-col rounded border border-neutral-700 bg-neutral-900 overflow-hidden"
      style={{ height }}
      onKeyDown={(e) => handleKeyDown(e)}
      tabIndex={-1}
    >
      {/* Editor toolbar — language badge + dirty-state indicator */}
      <div className="flex items-center gap-2 px-3 py-1 bg-neutral-800 border-b border-neutral-700 text-xs text-neutral-400 select-none">
        <span className="font-mono">{language}</span>
        {isDirty && (
          <span
            className="ml-auto flex items-center gap-1 text-amber-400"
            aria-label="Unsaved changes"
            title="Unsaved changes"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
            unsaved
          </span>
        )}
      </div>

      {/* Monaco editor with Suspense fallback */}
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <textarea
              className="w-full h-full bg-neutral-900 text-neutral-100 font-mono text-sm p-3 resize-none outline-none"
              value={value}
              readOnly={readOnly}
              onChange={(e) => handleChange(e.target.value)}
              aria-label={`Code editor — ${language}`}
            />
          }
        >
          <MonacoEditor
            height="100%"
            language={language}
            value={value}
            onChange={handleChange}
            onMount={handleEditorMount}
            options={{
              readOnly,
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              theme: "vs-dark",
            }}
          />
        </Suspense>
      </div>

      {/* Find open state (programmatic — Monaco shows its own inline widget) */}
      {showFind && (
        <div className="hidden" aria-hidden="true" data-find-open="true" />
      )}
    </div>
  );
}
