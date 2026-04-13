/**
 * Contract Schema — Inter-agent contract for implementor/validator coordination
 *
 * ADR-V4-03: Graph as shared memory, contract as decision node with Zod schema.
 */
import { z } from "zod/v4";

export const ContractResultSchema = z.object({
  claim: z.string().min(1),
  validated: z.boolean(),
  evidence: z.string().optional(),
});

export const ContractSchema = z.object({
  taskId: z.string().min(1),
  implementorClaims: z.array(z.string().min(1)).min(1),
  validationCriteria: z.array(z.string().min(1)).min(1),
  results: z.array(ContractResultSchema),
});

export type Contract = z.infer<typeof ContractSchema>;
export type ContractResult = z.infer<typeof ContractResultSchema>;
