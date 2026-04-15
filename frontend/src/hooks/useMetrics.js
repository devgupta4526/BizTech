import { useQuery } from "@tanstack/react-query";
import { fetchMetrics } from "../api/client";

export function useMetrics(filters = {}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["metrics", filters],
    queryFn: () => fetchMetrics(filters),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  return { data, loading: isLoading, error, refetch };
}
