const WORKERS = [
  { id: "W1", name: "Arjun Sharma" },
  { id: "W2", name: "Priya Nair" },
  { id: "W3", name: "Ravi Kumar" },
  { id: "W4", name: "Meena Patel" },
  { id: "W5", name: "Suresh Raj" },
  { id: "W6", name: "Divya Menon" },
];

const STATIONS = [
  { id: "S1", name: "Assembly Line A" },
  { id: "S2", name: "Assembly Line B" },
  { id: "S3", name: "Welding Station" },
  { id: "S4", name: "Quality Control" },
  { id: "S5", name: "Packaging Unit" },
  { id: "S6", name: "Material Handling" },
];

export default function FilterBar({ workerId, stationId, onChange }) {
  const handleWorkerChange = (e) => {
    const val = e.target.value || null;
    onChange({ workerId: val, stationId: null });
  };

  const handleStationChange = (e) => {
    const val = e.target.value || null;
    onChange({ workerId: null, stationId: val });
  };

  const clear = () => onChange({ workerId: null, stationId: null });

  return (
    <div className="flex flex-wrap items-center gap-4 mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-2">
        <label htmlFor="worker-filter" className="text-sm font-medium text-gray-700">
          Worker
        </label>
        <select
          id="worker-filter"
          value={workerId || ""}
          onChange={handleWorkerChange}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          <option value="">All Workers</option>
          {WORKERS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.id}: {w.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="station-filter" className="text-sm font-medium text-gray-700">
          Station
        </label>
        <select
          id="station-filter"
          value={stationId || ""}
          onChange={handleStationChange}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          <option value="">All Stations</option>
          {STATIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id}: {s.name}
            </option>
          ))}
        </select>
      </div>

      {(workerId || stationId) && (
        <button
          onClick={clear}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
