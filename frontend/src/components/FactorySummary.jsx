import clsx from "clsx";

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function utilizationColor(pct) {
  if (pct >= 70) return "bg-green-100 text-green-800";
  if (pct >= 40) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

export default function FactorySummary({ factory }) {
  if (!factory) return null;

  const cards = [
    {
      label: "Total Units Produced",
      value: factory.totalProductionCount,
      sub: null,
    },
    {
      label: "Avg Worker Utilization",
      value: `${factory.avgWorkerUtilizationPct}%`,
      badge: true,
    },
    {
      label: "Total Productive Time",
      value: formatTime(factory.totalProductiveTimeSec),
      sub: null,
    },
    {
      label: "Avg Production Rate",
      value: `${factory.avgProductionRatePerHour} u/hr`,
      sub: null,
    },
    {
      label: "Active Workers",
      value: `${factory.activeWorkers} / 6`,
      sub: null,
    },
    {
      label: "Top Performer",
      value: factory.topPerformingWorker?.name ?? "—",
      sub: factory.topPerformingWorker
        ? `${factory.topPerformingWorker.units} units`
        : null,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col items-center text-center"
        >
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {c.label}
          </span>
          <span
            className={clsx(
              "mt-2 text-2xl font-bold",
              c.badge &&
                "inline-block px-3 py-1 rounded-full text-lg " +
                  utilizationColor(factory.avgWorkerUtilizationPct)
            )}
          >
            {c.value}
          </span>
          {c.sub && <span className="text-sm text-gray-500 mt-1">{c.sub}</span>}
        </div>
      ))}
    </div>
  );
}
