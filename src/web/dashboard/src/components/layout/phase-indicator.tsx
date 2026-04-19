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

import { memo, useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LIFECYCLE_PHASES, PHASE_COLORS } from "@/lib/constants";

const PHASE_DESCRIPTIONS: Record<string, string> = {
  ANALYZE: "Define requirements, create PRD",
  DESIGN: "Architecture, ADRs, interfaces",
  PLAN: "Sprint planning, decomposition",
  IMPLEMENT: "TDD Red-Green-Refactor",
  VALIDATE: "E2E tests, acceptance criteria",
  REVIEW: "Code review, blast radius",
  HANDOFF: "PR, docs, export",
  DEPLOY: "CI/CD, release validation",
  LISTENING: "Feedback, new cycle",
};

interface PhaseIndicatorProps {
  currentPhase: string;
  isOverride: boolean;
  guidance: {
    reminder: string;
    suggestedTools: string[];
    principles: string[];
    suggestedSkills: string[];
  };
}

export const PhaseIndicator = memo(function PhaseIndicator({
  currentPhase,
  isOverride,
  guidance,
}: PhaseIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = useCallback(() => setExpanded((e) => !e), []);
  const currentIndex = LIFECYCLE_PHASES.indexOf(currentPhase as typeof LIFECYCLE_PHASES[number]);
  const color = PHASE_COLORS[currentPhase] || "#6b7280";

  return (
    <div className="border-b border-edge bg-surface">
      {/* Compact phase pipeline */}
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center gap-2 px-3 py-1 hover:bg-surface-alt transition-colors"
      >
        {/* Phase dots pipeline */}
        <div className="flex items-center gap-0 flex-1 min-w-0">
          {LIFECYCLE_PHASES.map((phase, i) => {
            const phaseColor = PHASE_COLORS[phase];
            const isActive = phase === currentPhase;
            const isPast = i < currentIndex;

            return (
              <div key={phase} className="flex items-center">
                {i > 0 && (
                  <div
                    className="w-3 h-0.5 md:w-5 lg:w-8"
                    style={{
                      background: isPast ? phaseColor : `${phaseColor}30`,
                    }}
                  />
                )}
                <div className="relative group">
                  <div
                    className={`rounded-full transition-all ${
                      isActive
                        ? "w-3 h-3 ring-2 ring-offset-1 ring-offset-surface"
                        : isPast
                          ? "w-2 h-2 opacity-80"
                          : "w-2 h-2 opacity-30"
                    }`}
                    style={{
                      background: phaseColor,
                      ...(isActive ? { "--tw-ring-color": phaseColor } as React.CSSProperties : {}),
                    }}
                  />
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                    <div className="bg-foreground text-surface text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                      <span className="font-semibold">{phase}</span>
                      <span className="opacity-70"> — {PHASE_DESCRIPTIONS[phase]}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current phase label */}
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0"
          style={{ background: color }}
        >
          {currentPhase}
        </span>
        {isOverride && (
          <span className="text-[9px] text-muted">(manual)</span>
        )}

        {expanded ? (
          <ChevronUp className="w-3 h-3 text-muted shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 text-muted shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-2 space-y-2 border-t border-edge bg-surface-alt">
          {/* Reminder */}
          <p className="text-[11px] text-muted pt-2 leading-relaxed italic">
            {guidance.reminder}
          </p>

          {/* Tools + Skills */}
          <div className="flex flex-wrap gap-3">
            {guidance.suggestedTools.length > 0 && (
              <div>
                <span className="text-[9px] font-semibold text-muted uppercase tracking-wider">Tools</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {guidance.suggestedTools.map((tool) => (
                    <span key={tool} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(guidance.suggestedSkills?.length ?? 0) > 0 && (
              <div>
                <span className="text-[9px] font-semibold text-muted uppercase tracking-wider">Skills</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {guidance.suggestedSkills.map((skill) => (
                    <span key={skill} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Principles */}
          {guidance.principles.length > 0 && (
            <div>
              <span className="text-[9px] font-semibold text-muted uppercase tracking-wider">Principles</span>
              <ul className="mt-0.5 space-y-0.5">
                {guidance.principles.map((p, i) => (
                  <li key={i} className="text-[10px] text-foreground">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
