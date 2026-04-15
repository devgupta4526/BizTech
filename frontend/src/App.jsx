import { useState, useCallback } from "react";
import { useMetrics } from "./hooks/useMetrics";
import { seedData } from "./api/client";
import FactorySummary from "./components/FactorySummary";
import FilterBar from "./components/FilterBar";
import WorkerCard from "./components/WorkerCard";
import StationCard from "./components/StationCard";
import MetricsChart from "./components/MetricsChart";

export default function App() {
  const [filters, setFilters] = useState({ workerId: null, stationId: null });
  const [seeding, setSeeding] = useState(false);

  const { data, loading, error, refetch } = useMetrics(filters);

  const handleSeed = useCallback(async () => {
    setSeeding(true);
    try {
      await seedData(true);
      await refetch();
    } finally {
      setSeeding(false);
    }
  }, [refetch]);

  const avgStationUnits =
    data?.stations?.reduce((s, st) => s + st.totalUnitsProduced, 0) /
      (data?.stations?.length || 1) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              Factory Productivity Dashboard
            </h1>
            {data?.generatedAt && (
              <p className="text-xs text-gray-500 mt-0.5">
                Last updated: {new Date(data.generatedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
            >
              {seeding ? "Seeding…" : "Seed Data"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            Failed to load metrics. {error.message}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-4 h-24 animate-pulse"
              />
            ))}
          </div>
        )}

        {data && (
          <>
            <FactorySummary factory={data.factory} />
            <FilterBar
              workerId={filters.workerId}
              stationId={filters.stationId}
              onChange={setFilters}
            />

            {/* Filtered: single worker */}
            {filters.workerId && (
              <>
                <WorkerCard
                  worker={data.workers?.find(
                    (w) => w.workerId === filters.workerId
                  )}
                  expanded
                />
                <MetricsChart
                  type="worker"
                  id={filters.workerId}
                  data={data}
                />
              </>
            )}

            {/* Filtered: single station */}
            {filters.stationId && (
              <>
                <StationCard
                  station={data.stations?.find(
                    (s) => s.stationId === filters.stationId
                  )}
                  expanded
                  avgUnits={avgStationUnits}
                />
                <MetricsChart
                  type="station"
                  id={filters.stationId}
                  data={data}
                />
              </>
            )}

            {/* No filter: all workers + stations */}
            {!filters.workerId && !filters.stationId && (
              <>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">
                  Workers
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {data.workers?.map((w) => (
                    <WorkerCard key={w.workerId} worker={w} />
                  ))}
                </div>

                <h2 className="text-lg font-semibold text-gray-800 mb-3">
                  Workstations
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.stations?.map((s) => (
                    <StationCard
                      key={s.stationId}
                      station={s}
                      avgUnits={avgStationUnits}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
