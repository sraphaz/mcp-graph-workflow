import { HarnessGauge } from "@/components/harness/harness-gauge";
import { HarnessTrend } from "@/components/harness/harness-trend";
import { IssuePatternTracker } from "@/components/harness/issue-pattern-tracker";
import { PhaseGatesStatus } from "@/components/harness/phase-gates-status";
import { HarnessEventsLog } from "@/components/harness/harness-events-log";
import { RemediationPanel } from "@/components/harness/remediation-panel";

export function HarnessTab(): React.JSX.Element {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h2 className="text-lg font-semibold text-white">Harnessability Score</h2>
      <p className="text-sm text-gray-400">
        Agent-readiness metric — measures how safe it is for an AI agent to work on this codebase.
        Based on Harness Engineering (Böckeler, Thoughtworks 2026).
      </p>

      {/* Row 1: Current Score + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Current Score</h3>
          <HarnessGauge />
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Trend</h3>
          <HarnessTrend />
        </div>
      </div>

      {/* Row 2: Issue Pattern Tracker (full width) */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Issue Pattern Tracker</h3>
        <IssuePatternTracker />
      </div>

      {/* Row 3: Remediation Suggestions (full width) */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Remediation Suggestions</h3>
        <RemediationPanel />
      </div>

      {/* Row 4: Phase Gates + Events Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Phase Gates</h3>
          <PhaseGatesStatus />
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Events Log</h3>
          <HarnessEventsLog />
        </div>
      </div>
    </div>
  );
}
