import clsx from "clsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function badgeColor(pct) {
  if (pct >= 70) return "bg-green-100 text-green-800";
  if (pct >= 40) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function barColor(pct) {
  if (pct >= 70) return "bg-green-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-red-500";
}

const TYPE_COLORS = {
  assembly: "bg-indigo-100 text-indigo-800",
  welding: "bg-orange-100 text-orange-800",
  inspection: "bg-cyan-100 text-cyan-800",
  packaging: "bg-pink-100 text-pink-800",
  logistics: "bg-violet-100 text-violet-800",
};

export default function StationCard({ station, expanded = false, avgUnits = 0 }) {
  if (!station) return null;

  const chartData = [
    { name: station.name, Units: station.totalUnitsProduced },
    { name: "Avg Station", Units: Math.round(avgUnits) },
  ];

  return (
    <div
      className={clsx(
        "bg-white rounded-xl shadow-sm border border-gray-200 p-5 transition-all",
        expanded && "col-span-full"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">{station.name}</h3>
          <span
            className={clsx(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              TYPE_COLORS[station.stationType] || "bg-gray-100 text-gray-700"
            )}
          >
            {station.stationType}
          </span>
        </div>
        <span
          className={clsx(
            "text-sm font-semibold px-2.5 py-0.5 rounded-full",
            badgeColor(station.utilizationPct)
          )}
        >
          {station.utilizationPct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
        <div
          className={clsx("h-2.5 rounded-full", barColor(station.utilizationPct))}
          style={{ width: `${Math.min(station.utilizationPct, 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">Units Produced</span>
          <p className="font-medium">{station.totalUnitsProduced}</p>
        </div>
        <div>
          <span className="text-gray-500">Throughput</span>
          <p className="font-medium">{station.throughputPerHour} u/hr</p>
        </div>
      </div>

      {expanded && (
        <div className="mt-6 h-64">
          <h4 className="text-sm font-medium text-gray-600 mb-2">
            Output vs Average
          </h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="Units" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
