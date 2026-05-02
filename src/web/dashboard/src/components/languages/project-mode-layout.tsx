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

import type { TranslationProject, TranslationProjectFile, TranslationProjectSummary } from "@/lib/types";
import { ProjectFileTree } from "./project-file-tree";
import { ProjectDashboard } from "./project-dashboard";
import { ProjectFileDetail } from "./project-file-detail";

interface ProjectModeLayoutProps {
  project: TranslationProject;
  files: TranslationProjectFile[];
  summary: TranslationProjectSummary | null;
  selectedFileId: string | null;
  onSelectFile: (fileId: string | null) => void;
  onPrepareAll: () => void;
  onDownloadAll: () => void;
  onFinalizeFile: (fileId: string, generatedCode: string) => void;
  prompts?: Record<string, string>;
  loading?: boolean;
}

/** ProjectModeLayout — auto-generated description placeholder. */
export function ProjectModeLayout({
  project,
  files,
  summary,
  selectedFileId,
  onSelectFile,
  onPrepareAll,
  onDownloadAll,
  onFinalizeFile,
  prompts,
  loading,
}: ProjectModeLayoutProps): React.JSX.Element {
  const selectedFile = selectedFileId ? files.find((f) => f.id === selectedFileId) ?? null : null;

  const handleBack = (): void => {
    onSelectFile(null);
  };

  const handleFinalize = (generatedCode: string): void => {
    if (selectedFileId) {
      onFinalizeFile(selectedFileId, generatedCode);
    }
  };

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Left: file tree */}
      <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-edge overflow-hidden flex flex-col shrink-0">
        <ProjectFileTree
          files={files}
          selectedFileId={selectedFileId}
          onSelectFile={onSelectFile}
        />
      </div>

      {/* Right: dashboard or file detail */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedFile ? (
          <ProjectFileDetail
            file={selectedFile}
            prompt={prompts?.[selectedFile.id]}
            onBack={handleBack}
            onFinalize={handleFinalize}
            loading={loading}
          />
        ) : (
          <ProjectDashboard
            project={project}
            files={files}
            summary={summary}
            onPrepareAll={onPrepareAll}
            onDownloadAll={onDownloadAll}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
