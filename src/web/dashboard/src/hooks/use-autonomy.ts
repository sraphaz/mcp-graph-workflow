import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

export interface AutonomyStatus {
  autopilotActive: boolean;
  phase: string;
  harnessScore: number;
  harnessGrade: string;
  gates: {
    testGate: string;
    contractGate: string;
  };
  pipeline: {
    testGateWired: boolean;
    contractGateWired: boolean;
    prefetcherWired: boolean;
    adaptiveBudgetWired: boolean;
    astPruningWired: boolean;
    citationsWired: boolean;
  };
}

export interface AutonomySession {
  active: boolean;
  session: {
    id: string;
    sprintId: string;
    startedAt: string;
    status: string;
    tasksCompleted: number;
    tasksFailed: number;
    tokensUsed: number;
    config: Record<string, unknown>;
  } | null;
}

export interface AutonomyBudget {
  phase: string;
  distribution: {
    graph: number;
    knowledge: number;
    code: number;
    history: number;
  };
  preset: string;
  source: string;
  qLearning: {
    totalVisits: number;
    convergenceRate: number;
  };
}

export function useAutonomyStatus() {
  const [data, setData] = useState<AutonomyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiClient.request<AutonomyStatus>("/autonomy/status");
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load autonomy status");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return { data, loading, error };
}

export function useAutonomySession() {
  const [data, setData] = useState<AutonomySession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiClient.request<AutonomySession>("/autonomy/session");
        setData(result);
      } catch {
        // Session endpoint may fail if no session table
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return { data, loading };
}

export function useAutonomyBudget() {
  const [data, setData] = useState<AutonomyBudget | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiClient.request<AutonomyBudget>("/autonomy/budget");
        setData(result);
      } catch {
        // Budget endpoint may fail if no policy table
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return { data, loading };
}
