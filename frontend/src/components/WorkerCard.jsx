import clsx from "clsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function barColor(pct) {
  if (pct >= 70) return "bg-green-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function badgeColor(pct) {
  if (pct >= 70) return "bg-green-100 text-green-800";
  if (pct >= 40) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

export default function WorkerCard({ worker, expanded = false }) {
  if (!worker) return null;

  const chartData = [
    {
      name: worker.name,
      Active: Math.round(worker.totalActiveTimeSec / 60),
      Idle: Math.round(worker.totalIdleTimeSec / 60),
      Absent: Math.round(worker.totalAbsentTimeSec / 60),
    },
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
          <h3 className="font-semibold text-lg">{worker.name}</h3>
          <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {worker.workerId}
          </span>
        </div>
        <span
          className={clsx(
            "text-sm font-semibold px-2.5 py-0.5 rounded-full",
            badgeColor(worker.utilizationPct)
          )}
        >
          {worker.utilizationPct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
        <div
          className={clsx("h-2.5 rounded-full", barColor(worker.utilizationPct))}
          style={{ width: `${Math.min(worker.utilizationPct, 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">Active</span>
          <p className="font-medium">{formatTime(worker.totalActiveTimeSec)}</p>
        </div>
        <div>
          <span className="text-gray-500">Idle</span>
          <p className="font-medium">{formatTime(worker.totalIdleTimeSec)}</p>
        </div>
        <div>
          <span className="text-gray-500">Units Produced</span>
          <p className="font-medium">{worker.totalUnitsProduced}</p>
        </div>
        <div>
          <span className="text-gray-500">Units / hr</span>
          <p className="font-medium">{worker.unitsPerHour}</p>
        </div>
      </div>

      {worker.primaryStation && (
        <div className="mt-3">
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
            Primary: {worker.primaryStation}
          </span>
        </div>
      )}

      {expanded && (
        <div className="mt-6 h-64">
          <h4 className="text-sm font-medium text-gray-600 mb-2">
            Time Breakdown (minutes)
          </h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Active" fill="#22c55e" />
              <Bar dataKey="Idle" fill="#f59e0b" />
              <Bar dataKey="Absent" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
