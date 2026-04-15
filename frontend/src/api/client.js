import axios from "axios";

/**
 * VITE_API_URL should be the Render root, e.g. https://biztech-6tge.onrender.com
 * OR already include /api. Routes in this client use paths like /metrics → full URL must be .../api/metrics.
 */
function resolveApiBase() {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (!raw) return "/api";
  const noTrail = raw.replace(/\/+$/, "");
  if (noTrail.endsWith("/api")) return noTrail;
  return `${noTrail}/api`;
}

const api = axios.create({
  baseURL: resolveApiBase(),
  headers: { "Content-Type": "application/json" },
});

export async function fetchMetrics(filters = {}) {
  const params = {};
  if (filters.workerId) params.worker_id = filters.workerId;
  if (filters.stationId) params.station_id = filters.stationId;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  const { data } = await api.get("/metrics", { params });
  return data;
}

export async function ingestEvent(event) {
  const { data } = await api.post("/events/ingest", event);
  return data;
}

export async function seedData(clear = false) {
  const { data } = await api.post("/seed", { clear });
  return data;
}
