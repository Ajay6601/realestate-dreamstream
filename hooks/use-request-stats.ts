import { useState, useEffect, useCallback } from "react";

export interface RequestStats {
  used: number; // process_properties_requests (what counts against limit)
  remaining: number;
  limit: number;
  canMakeRequests: boolean; // Can we process properties?
  resetTime: string;
}

export function useRequestStats() {
  const [stats, setStats] = useState<RequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/request-stats");

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch request statistics");
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("Error fetching request stats:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    return () => clearInterval(interval);
  }, [fetchStats]);

  const refresh = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh,
  };
}
