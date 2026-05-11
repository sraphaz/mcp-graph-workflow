/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 3.3: LoadingState — consistent loading placeholder
 */

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message }: LoadingStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      <span
        role="status"
        aria-label={message ?? "Loading"}
        className="inline-block h-5 w-5 rounded-full border-2 border-slate-600 border-t-slate-300 animate-spin"
      />
      {message && <p className="text-xs text-slate-500">{message}</p>}
    </div>
  );
}
