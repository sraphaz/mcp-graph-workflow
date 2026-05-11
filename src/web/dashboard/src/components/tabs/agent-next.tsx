/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §node_635334a74e22 — Task 2.4: <AgentNext> — planned next actions list.
 */

export interface AgentNextStep {
  id: string;
  title: string;
  priority?: number;
  xpSize?: string;
}

interface AgentNextProps {
  steps: AgentNextStep[];
  onStepClick?: (id: string) => void;
}

/** AgentNext — flat list of planned next steps with optional click navigation. */
export function AgentNext({ steps, onStepClick }: AgentNextProps): React.JSX.Element {
  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center py-4 text-xs text-muted">
        No planned actions
      </div>
    );
  }

  return (
    <ul role="list" className="divide-y divide-edge">
      {steps.map((step) => (
        <li key={step.id} className="py-1.5 px-3">
          <button
            className="w-full text-left flex items-center gap-2 hover:text-foreground text-foreground/80"
            onClick={() => onStepClick?.(step.id)}
            aria-label={step.title}
          >
            {step.xpSize && (
              <span className="text-[10px] text-muted uppercase shrink-0">{step.xpSize}</span>
            )}
            <span className="text-xs font-mono truncate">{step.title}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
