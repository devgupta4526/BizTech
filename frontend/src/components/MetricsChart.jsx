import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function MetricsChart({ type, id, data }) {
  if (!data) return null;

  if (type === "worker") {
    const worker = data.workers?.find((w) => w.workerId === id);
    if (!worker) return null;

    const chartData = [
      {
        name: worker.name,
        "Active (min)": Math.round(worker.totalActiveTimeSec / 60),
        "Idle (min)": Math.round(worker.totalIdleTimeSec / 60),
        "Absent (min)": Math.round(worker.totalAbsentTimeSec / 60),
      },
    ];

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mt-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Time Distribution — {worker.name}
        </h4>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis dataKey="name" />
              <YAxis label={{ value: "Minutes", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Active (min)" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Idle (min)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Absent (min)" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (type === "station") {
    const station = data.stations?.find((s) => s.stationId === id);
    if (!station) return null;

    const avgUnits =
      data.stations.reduce((s, st) => s + st.totalUnitsProduced, 0) /
      data.stations.length;

    const chartData = [
      { name: station.name, Units: station.totalUnitsProduced },
      { name: "Avg Station", Units: Math.round(avgUnits) },
    ];

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mt-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Output Comparison — {station.name}
        </h4>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="Units" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return null;
}
