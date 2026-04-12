import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

interface PhaseData {
  currentPhase: string;
  isOverride: boolean;
  guidance: {
    reminder: string;
    suggestedTools: string[];
    principles: string[];
    suggestedSkills: string[];
  };
}

interface UsePhaseResult {
  phase: PhaseData | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function usePhase(): UsePhaseResult {
  const [phase, setPhase] = useState<PhaseData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiClient.getPhase();
      setPhase(data);
    } catch {
      // Phase endpoint may not exist yet — silently ignore
      setPhase(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { phase, loading, refresh };
}
