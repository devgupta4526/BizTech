const { PrismaClient } = require("@prisma/client");
const pino = require("pino");

const prisma = new PrismaClient();
const logger = pino({ name: "computeMetrics" });

const SHIFT_SECONDS = 28800; // 8 hours
const DEFAULT_LAST_EVENT_DURATION_SEC = 900; // 15 minutes

/**
 * Duration model:
 *   For each worker, events are sorted by timestamp ASC.
 *   Duration of event[i] = timestamp[i+1] - timestamp[i].
 *   The final event for each worker is assigned a default duration of 15 minutes.
 *
 * product_count events carry a `count` field representing units produced.
 *   They are additive — summed per worker / station. They do NOT contribute time.
 *
 * Utilization = active_time / (active_time + idle_time) * 100.
 *   Absent time is excluded from utilization.
 */
async function computeMetrics(filters = {}) {
  logger.info({ filters }, "Computing metrics (durations: per-worker sort, gap to next event, last event = 15m)");

  const where = {};
  if (filters.worker_id) where.workerId = filters.worker_id;
  if (filters.station_id) where.stationId = filters.station_id;
  if (filters.from || filters.to) {
    where.timestamp = {};
    if (filters.from) where.timestamp.gte = new Date(filters.from);
    if (filters.to) where.timestamp.lte = new Date(filters.to);
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { timestamp: "asc" },
    include: { worker: true, station: true },
  });

  const workers = await prisma.worker.findMany();
  const stations = await prisma.workstation.findMany();

  // ── Group events by worker ──
  const byWorker = {};
  for (const w of workers) byWorker[w.id] = { ...w, events: [] };
  for (const e of events) {
    if (byWorker[e.workerId]) byWorker[e.workerId].events.push(e);
  }
  for (const w of workers) {
    byWorker[w.id].events.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  }

  // ── Group events by station ──
  const byStation = {};
  for (const s of stations) byStation[s.id] = { ...s, events: [] };
  for (const e of events) {
    if (byStation[e.stationId]) byStation[e.stationId].events.push(e);
  }

  // ── Worker-level metrics ──
  const workerMetrics = workers.map((w) => {
    const wEvents = byWorker[w.id].events;
    let totalActiveTimeSec = 0;
    let totalIdleTimeSec = 0;
    let totalAbsentTimeSec = 0;
    let totalUnitsProduced = 0;
    const stationCount = {};

    for (let i = 0; i < wEvents.length; i++) {
      const evt = wEvents[i];
      const durationSec =
        i < wEvents.length - 1
          ? (new Date(wEvents[i + 1].timestamp).getTime() -
              new Date(evt.timestamp).getTime()) /
            1000
          : DEFAULT_LAST_EVENT_DURATION_SEC;

      if (evt.eventType === "working") totalActiveTimeSec += durationSec;
      else if (evt.eventType === "idle") totalIdleTimeSec += durationSec;
      else if (evt.eventType === "absent") totalAbsentTimeSec += durationSec;

      if (evt.eventType === "product_count") {
        totalUnitsProduced += evt.count;
      }

      stationCount[evt.stationId] = (stationCount[evt.stationId] || 0) + 1;
    }

    const utilizationPct =
      totalActiveTimeSec + totalIdleTimeSec > 0
        ? +((totalActiveTimeSec / (totalActiveTimeSec + totalIdleTimeSec)) * 100).toFixed(1)
        : 0;

    const unitsPerHour =
      totalActiveTimeSec > 0
        ? +(totalUnitsProduced / (totalActiveTimeSec / 3600)).toFixed(2)
        : 0;

    const primaryStation =
      Object.entries(stationCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      workerId: w.id,
      name: w.name,
      totalActiveTimeSec: Math.round(totalActiveTimeSec),
      totalIdleTimeSec: Math.round(totalIdleTimeSec),
      totalAbsentTimeSec: Math.round(totalAbsentTimeSec),
      utilizationPct,
      totalUnitsProduced,
      unitsPerHour,
      primaryStation,
    };
  });

  // ── Station-level metrics ──
  const stationMetrics = stations.map((s) => {
    const sEvents = byStation[s.id].events;
    let occupancyTimeSec = 0;
    let totalUnitsProduced = 0;

    // Build per-worker timeline at this station to compute durations correctly
    const workerEventsHere = {};
    for (const evt of sEvents) {
      if (!workerEventsHere[evt.workerId]) workerEventsHere[evt.workerId] = [];
      workerEventsHere[evt.workerId].push(evt);
    }

    for (const wId of Object.keys(workerEventsHere)) {
      const wEvts = workerEventsHere[wId].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
      for (let i = 0; i < wEvts.length; i++) {
        const evt = wEvts[i];
        const durationSec =
          i < wEvts.length - 1
            ? (new Date(wEvts[i + 1].timestamp).getTime() -
                new Date(evt.timestamp).getTime()) /
              1000
            : DEFAULT_LAST_EVENT_DURATION_SEC;

        if (evt.eventType === "working") occupancyTimeSec += durationSec;
        if (evt.eventType === "product_count") totalUnitsProduced += evt.count;
      }
    }

    const utilizationPct = +((occupancyTimeSec / SHIFT_SECONDS) * 100).toFixed(1);
    const throughputPerHour = +(totalUnitsProduced / 8).toFixed(2);

    return {
      stationId: s.id,
      name: s.name,
      stationType: s.stationType,
      occupancyTimeSec: Math.round(occupancyTimeSec),
      utilizationPct,
      totalUnitsProduced,
      throughputPerHour,
    };
  });

  // ── Factory-level metrics ──
  const totalProductiveTimeSec = workerMetrics.reduce(
    (sum, w) => sum + w.totalActiveTimeSec,
    0
  );
  const totalProductionCount = workerMetrics.reduce(
    (sum, w) => sum + w.totalUnitsProduced,
    0
  );
  const avgProductionRatePerHour = +(totalProductionCount / 8).toFixed(2);
  const avgWorkerUtilizationPct =
    workerMetrics.length > 0
      ? +(
          workerMetrics.reduce((sum, w) => sum + w.utilizationPct, 0) /
          workerMetrics.length
        ).toFixed(1)
      : 0;
  const activeWorkers = workerMetrics.filter((w) => w.utilizationPct > 0).length;
  const topPerformingWorker =
    [...workerMetrics].sort((a, b) => b.totalUnitsProduced - a.totalUnitsProduced)[0] ||
    null;

  const factory = {
    totalProductiveTimeSec,
    totalProductionCount,
    avgProductionRatePerHour,
    avgWorkerUtilizationPct,
    activeWorkers,
    topPerformingWorker: topPerformingWorker
      ? { workerId: topPerformingWorker.workerId, name: topPerformingWorker.name, units: topPerformingWorker.totalUnitsProduced }
      : null,
  };

  logger.info("Metrics computed");

  return {
    factory,
    workers: workerMetrics,
    stations: stationMetrics,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { computeMetrics };
