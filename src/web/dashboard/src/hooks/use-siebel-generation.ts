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
 * Hook for SIF generation workflow state (prepare + finalize).
 */

import { useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

export interface ValidationMessage {
  level: string;
  message: string;
  objectName?: string;
}

export interface GenerationResult {
  sifContent: string;
  objects: Array<{ name: string; type: string }>;
  validation: {
    status: string;
    messages: ValidationMessage[];
    score: number;
  };
  metadata: {
    generatedAt: string;
    requestDescription: string;
    objectCount: number;
  };
}

interface UseSiebelGenerationReturn {
  description: string;
  setDescription: (v: string) => void;
  selectedTypes: string[];
  toggleType: (type: string) => void;
  project: string;
  setProject: (v: string) => void;
  prompt: string | null;
  xml: string;
  setXml: (v: string) => void;
  result: GenerationResult | null;
  loading: boolean;
  prepare: () => Promise<void>;
  finalize: () => Promise<void>;
  download: () => void;
}

/** useSiebelGeneration — auto-generated description placeholder. */
export function useSiebelGeneration(onSuccess?: () => void): UseSiebelGenerationReturn {
  const [description, setDescription] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["business_component"]);
  const [project, setProject] = useState("");
  const [prompt, setPrompt] = useState<string | null>(null);
  const [xml, setXml] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleType = useCallback((type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type],
    );
  }, []);

  const prepare = useCallback(async () => {
    if (!description.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await apiClient.siebelPrepareGeneration({
        description,
        objectTypes: selectedTypes,
        basedOnProject: project || undefined,
      });
      setPrompt(res.prompt);
    } catch (err) {
      setPrompt(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [description, selectedTypes, project]);

  const finalize = useCallback(async () => {
    if (!xml.trim()) return;
    setLoading(true);
    try {
      const res = await apiClient.siebelFinalizeGeneration({
        generatedXml: xml,
        description,
        objectTypes: selectedTypes,
      });
      setResult(res);
      onSuccess?.();
    } catch (err) {
      setResult({
        sifContent: "",
        objects: [],
        validation: {
          status: "invalid",
          messages: [{ level: "error", message: err instanceof Error ? err.message : String(err) }],
          score: 0,
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          requestDescription: description,
          objectCount: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [xml, description, selectedTypes, onSuccess]);

  const download = useCallback(() => {
    if (!result?.sifContent) return;
    const blob = new Blob([result.sifContent], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "generated.sif";
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  return {
    description, setDescription,
    selectedTypes, toggleType,
    project, setProject,
    prompt,
    xml, setXml,
    result, loading,
    prepare, finalize, download,
  };
}
