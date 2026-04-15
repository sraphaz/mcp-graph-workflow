/**
 * Property Invariants — stub for hook-injected import.
 * Provides type-safe placeholders until full implementation.
 */

export interface PropertyInvariant {
  id: string;
  name: string;
  check: (content: string) => boolean;
}

export interface InvariantViolation {
  invariantId: string;
  file: string;
  line: number;
  message: string;
}

export interface InvariantResult {
  passed: boolean;
  violations: InvariantViolation[];
}

export function getBuiltInInvariants(): PropertyInvariant[] {
  return [];
}

export function checkInvariants(_doc: unknown, _invariants?: PropertyInvariant[]): InvariantResult {
  return { passed: true, violations: [] };
}
