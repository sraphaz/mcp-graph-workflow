/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 3.1: Card — standard card shell
 */

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps): React.JSX.Element {
  return (
    <div className={`rounded-lg border border-slate-700 bg-slate-800/60 p-4 ${className}`}>
      {children}
    </div>
  );
}
