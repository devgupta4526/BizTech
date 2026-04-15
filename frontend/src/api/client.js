import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
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
