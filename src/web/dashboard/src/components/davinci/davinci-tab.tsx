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

import { useState, useCallback } from "react";
import {
  Upload,
  Search,
  Code,
  Hammer,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

type Section = "upload" | "analysis" | "preview" | "build";

interface EnvironmentItem {
  name: string;
  available: boolean;
  version?: string;
  installUrl?: string;
  instruction?: string;
}

interface AnalysisResult {
  variables: Array<{ kind: string; fieldName: string; rawTemplate: string }>;
  codeLocation: string;
  apiCalls: Array<{ method: string; url?: string; line: number }>;
  flowLogic: Record<string, boolean>;
  recommendedPluginType: string;
  pluginTypeConfidence: number;
  warnings: string[];
  sourceLineCount: number;
}

interface ConvertResult {
  javaCode: string;
  pomXml: string;
  pfInfContent: string;
  pfInfType: string;
  pluginType: string;
  confidence: number;
  warnings: string[];
}

const API_BASE = "/api/v1/davinci";

/** DavinciTab — auto-generated description placeholder. */
export function DavinciTab() {
  const [section, setSection] = useState<Section>("upload");
  const [code, setCode] = useState("");
  const [targetSdk, setTargetSdk] = useState<"pingfederate" | "pingaccess">("pingfederate");
  const [pluginName, setPluginName] = useState("my-davinci-plugin");
  const [packageName, setPackageName] = useState("com.example.plugin");
  const [className, setClassName] = useState("MyDaVinciPlugin");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentItem[] | null>(null);
  const [buildResult, setBuildResult] = useState<{ ok: boolean; jarPath?: string; buildDurationMs?: number; buildErrors?: string; projectDir?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEnvironment = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/environment`);
      const data = await res.json();
      if (data.ok) setEnvironment(data.environment.items);
    } catch { /* ignore */ }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.ok) {
        setAnalysis(data.analysis);
        setSection("analysis");
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [code]);

  const handleConvert = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, pluginName, packageName, className, targetSdk }),
      });
      const data = await res.json();
      if (data.ok) {
        setConvertResult(data);
        setSection("preview");
        fetchEnvironment();
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setLoading(false);
    }
  }, [code, pluginName, packageName, className, targetSdk, fetchEnvironment]);

  const handleBuildJar = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setBuildResult(null);
    try {
      const res = await fetch(`${API_BASE}/convert-and-build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, pluginName, packageName, className, targetSdk }),
      });
      const data = await res.json();
      setBuildResult(data);
      if (!data.ok && data.phase === "environment_check") {
        setError("Build environment not ready. Install missing tools.");
      } else if (!data.ok) {
        setError(data.buildErrors || "Build failed");
      }
      fetchEnvironment();
      setSection("build");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Build failed");
    } finally {
      setLoading(false);
    }
  }, [code, pluginName, packageName, className, targetSdk, fetchEnvironment]);

  return (
    <div className="flex flex-col h-full">
      {/* Section Navigation */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-700/50 bg-zinc-900/50">
        {(["upload", "analysis", "preview", "build"] as Section[]).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              section === s
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            {s === "upload" && <Upload size={14} />}
            {s === "analysis" && <Search size={14} />}
            {s === "preview" && <Code size={14} />}
            {s === "build" && <Hammer size={14} />}
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle size={14} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">x</button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {/* ── Upload Section ──────────────────────────────────── */}
        {section === "upload" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200">DaVinci Custom Code</h3>
            <p className="text-xs text-zinc-400">
              Paste your DaVinci JavaScript code (Custom Function, Code Snippet, or HTML Template).
            </p>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={`module.exports = a = async ({params}) => {\n  const apiKey = "{{global.variables.apiKey}}";\n  // your DaVinci logic here\n  return { result: "ok" };\n}`}
              className="w-full h-64 bg-zinc-900 border border-zinc-700 rounded p-3 text-xs font-mono text-zinc-200 resize-y focus:outline-none focus:border-blue-500"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Target SDK</label>
                <select
                  value={targetSdk}
                  onChange={(e) => setTargetSdk(e.target.value as "pingfederate" | "pingaccess")}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                >
                  <option value="pingfederate">PingFederate</option>
                  <option value="pingaccess">PingAccess</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Plugin Name</label>
                <input
                  value={pluginName}
                  onChange={(e) => setPluginName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Package Name</label>
                <input
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Class Name</label>
                <input
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAnalyze}
                disabled={loading || !code.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded font-medium"
              >
                {loading ? "Analyzing..." : "Analyze"}
              </button>
              <button
                onClick={handleConvert}
                disabled={loading || !code.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs rounded font-medium"
              >
                {loading ? "Converting..." : "Convert to Java"}
              </button>
            </div>
          </div>
        )}

        {/* ── Analysis Section ────────────────────────────────── */}
        {section === "analysis" && analysis && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200">Analysis Results</h3>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-900 border border-zinc-700 rounded p-3">
                <div className="text-xs text-zinc-400">Variables</div>
                <div className="text-lg font-bold text-blue-400">{analysis.variables.length}</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-700 rounded p-3">
                <div className="text-xs text-zinc-400">API Calls</div>
                <div className="text-lg font-bold text-purple-400">{analysis.apiCalls.length}</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-700 rounded p-3">
                <div className="text-xs text-zinc-400">Plugin Type</div>
                <div className="text-sm font-bold text-green-400">{analysis.recommendedPluginType}</div>
                <div className="text-xs text-zinc-500">{(analysis.pluginTypeConfidence * 100).toFixed(0)}% confidence</div>
              </div>
            </div>

            {analysis.variables.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-zinc-300 mb-2">Variables Detected</h4>
                <div className="space-y-1">
                  {analysis.variables.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-zinc-900/50 px-2 py-1 rounded">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        v.kind === "global" ? "bg-blue-900/50 text-blue-300" :
                        v.kind === "local" ? "bg-yellow-900/50 text-yellow-300" :
                        v.kind === "flow" ? "bg-purple-900/50 text-purple-300" :
                        "bg-zinc-800 text-zinc-300"
                      }`}>{v.kind}</span>
                      <span className="font-mono text-zinc-300">{v.fieldName}</span>
                      <span className="text-zinc-500 ml-auto">{v.rawTemplate}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-zinc-300 mb-2">Flow Logic</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(analysis.flowLogic).map(([key, val]) => (
                  <span key={key} className={`px-2 py-1 rounded text-[10px] font-medium ${
                    val ? "bg-green-900/30 text-green-400" : "bg-zinc-800 text-zinc-500"
                  }`}>
                    {val ? <CheckCircle size={10} className="inline mr-1" /> : null}
                    {key.replace("has", "")}
                  </span>
                ))}
              </div>
            </div>

            {analysis.warnings.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-yellow-400 mb-2">Warnings</h4>
                {analysis.warnings.map((w, i) => (
                  <div key={i} className="text-xs text-yellow-300 bg-yellow-900/20 px-2 py-1 rounded mb-1 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleConvert}
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs rounded font-medium flex items-center gap-1.5"
            >
              <ChevronRight size={14} />
              {loading ? "Converting..." : "Convert to Java"}
            </button>
          </div>
        )}

        {section === "analysis" && !analysis && (
          <div className="text-center text-zinc-500 text-sm py-12">
            No analysis yet. Go to Upload and click Analyze.
          </div>
        )}

        {/* ── Preview Section ─────────────────────────────────── */}
        {section === "preview" && convertResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">Generated Java Plugin</h3>
              <span className="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded">
                {convertResult.pluginType} ({(convertResult.confidence * 100).toFixed(0)}%)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Java Code */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-zinc-400">Java Source</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(convertResult.javaCode)}
                    className="text-[10px] text-blue-400 hover:text-blue-300"
                  >Copy</button>
                </div>
                <pre className="bg-zinc-950 border border-zinc-700 rounded p-3 text-[11px] font-mono text-zinc-300 overflow-auto max-h-96">
                  {convertResult.javaCode}
                </pre>
              </div>

              {/* POM.xml */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-zinc-400">pom.xml</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(convertResult.pomXml)}
                    className="text-[10px] text-blue-400 hover:text-blue-300"
                  >Copy</button>
                </div>
                <pre className="bg-zinc-950 border border-zinc-700 rounded p-3 text-[11px] font-mono text-zinc-300 overflow-auto max-h-96">
                  {convertResult.pomXml}
                </pre>
              </div>
            </div>

            {/* PF-INF */}
            <div className="bg-zinc-900 border border-zinc-700 rounded p-3">
              <span className="text-xs text-zinc-400">PF-INF Descriptor: </span>
              <span className="text-xs font-mono text-zinc-200">{convertResult.pfInfType}/{convertResult.pfInfContent}</span>
            </div>

            {convertResult.warnings.length > 0 && (
              <div>
                {convertResult.warnings.map((w, i) => (
                  <div key={i} className="text-xs text-yellow-300 bg-yellow-900/20 px-2 py-1 rounded mb-1 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {section === "preview" && !convertResult && (
          <div className="text-center text-zinc-500 text-sm py-12">
            No conversion yet. Go to Upload and click Convert.
          </div>
        )}

        {/* ── Build Section ───────────────────────────────────── */}
        {section === "build" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200">Build Environment</h3>
            <p className="text-xs text-zinc-400">
              Check if your environment has JDK + Maven installed to compile the plugin JAR.
            </p>

            <button
              onClick={fetchEnvironment}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded font-medium"
            >
              Check Environment
            </button>

            {environment && (
              <div className="space-y-2">
                {environment.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded p-3"
                  >
                    {item.available ? (
                      <CheckCircle size={18} className="text-green-500 shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-red-500 shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="text-xs font-medium text-zinc-200">{item.name}</div>
                      {item.available && item.version && (
                        <div className="text-[10px] text-zinc-500">v{item.version}</div>
                      )}
                      {!item.available && item.instruction && (
                        <div className="text-[10px] text-red-400">{item.instruction}</div>
                      )}
                    </div>
                    {!item.available && item.installUrl && (
                      <a
                        href={item.installUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                      >
                        Install
                      </a>
                    )}
                  </div>
                ))}

                <div className={`flex items-center gap-2 p-3 rounded border ${
                  environment.every((i) => i.available)
                    ? "bg-green-900/20 border-green-700/50 text-green-400"
                    : "bg-red-900/20 border-red-700/50 text-red-400"
                }`}>
                  {environment.every((i) => i.available) ? (
                    <>
                      <CheckCircle size={16} />
                      <span className="text-xs font-medium">Ready to Build</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      <span className="text-xs font-medium">Not Ready — install missing tools</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Build JAR Button */}
            {environment && environment.every((i) => i.available) && code.trim() && (
              <div className="pt-2 border-t border-zinc-700/50">
                <button
                  onClick={handleBuildJar}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs rounded font-medium flex items-center gap-1.5"
                >
                  <Hammer size={14} />
                  {loading ? "Building..." : "Build JAR"}
                </button>
              </div>
            )}

            {/* Build Result */}
            {buildResult && (
              <div className={`p-3 rounded border ${
                buildResult.ok
                  ? "bg-green-900/20 border-green-700/50"
                  : "bg-red-900/20 border-red-700/50"
              }`}>
                {buildResult.ok ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle size={16} />
                      <span className="text-xs font-medium">Build Successful!</span>
                      {buildResult.buildDurationMs && (
                        <span className="text-[10px] text-zinc-500 ml-auto">{(buildResult.buildDurationMs / 1000).toFixed(1)}s</span>
                      )}
                    </div>
                    {buildResult.jarPath && (
                      <div className="space-y-1">
                        <div className="text-[11px] text-zinc-300 font-mono bg-zinc-950 px-2 py-1 rounded">
                          {buildResult.jarPath}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          Project: {buildResult.projectDir}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-400">
                      <XCircle size={16} />
                      <span className="text-xs font-medium">Build Failed</span>
                    </div>
                    {buildResult.buildErrors && (
                      <pre className="text-[10px] text-red-300 bg-zinc-950 px-2 py-1 rounded overflow-auto max-h-32">
                        {buildResult.buildErrors}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
