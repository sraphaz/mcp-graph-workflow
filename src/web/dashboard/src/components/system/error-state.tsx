/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 3.3: ErrorState — consistent error placeholder with optional retry
 */

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-slate-500">
      <span className="text-2xl" aria-hidden="true">⚠</span>
      <p className="text-sm text-red-400 text-center">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
