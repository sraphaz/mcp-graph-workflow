/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 3.1: EmptyState — zero-data placeholder
 */

interface EmptyStateProps {
  message: string;
  icon?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ message, icon, action }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-slate-500">
      {icon && <span className="text-3xl" aria-hidden="true">{icon}</span>}
      <p className="text-sm text-center">{message}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
