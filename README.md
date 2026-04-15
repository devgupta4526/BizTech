# Factory Productivity Dashboard

An AI-powered CCTV worker monitoring dashboard that ingests machine-vision events from factory cameras and presents real-time productivity metrics for workers, workstations, and the factory as a whole.

---

## Quick Start

### Local Development (without Docker)

```bash
# 1. Install backend dependencies
cd backend
npm install

# 2. Generate Prisma client & run initial migration
npx prisma generate
npx prisma db push

# 3. Seed the database
node prisma/seed.js

# 4. Start the API server (port 3001)
node src/index.js

# 5. In a new terminal — install frontend dependencies
cd frontend
npm install

# 6. Start the dev server (port 3000, proxies /api → 3001)
npm run dev
```

### Docker Compose

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Health check: http://localhost:3001/health

On first boot the backend auto-runs Prisma migrations and seeds the database if the events table is empty.

---

## Architecture

```
Edge (CCTV cameras)
       │
       ▼
POST /api/events/ingest   ←── JSON event payloads
       │
       ▼
   SQLite DB (Prisma ORM)
       │
       ▼
GET /api/metrics           ←── computed on the fly
       │
       ▼
  React Dashboard (Vite + TailwindCSS + Recharts)
```

---

## Database Schema

### Worker
| Field  | Type   | Notes              |
|--------|--------|--------------------|
| id     | String | PK — "W1" … "W6"  |
| name   | String | Full name          |

### Workstation
| Field       | Type   | Notes                          |
|-------------|--------|--------------------------------|
| id          | String | PK — "S1" … "S6"              |
| name        | String | Display name                   |
| stationType | String | assembly / welding / inspection / packaging / logistics |

### Event
| Field          | Type     | Notes                                                  |
|----------------|----------|--------------------------------------------------------|
| id             | Int      | Auto-increment PK                                      |
| timestamp      | DateTime | When the event occurred on-camera                      |
| receivedAt     | DateTime | Server receipt time (default: now())                   |
| workerId       | String   | FK → Worker                                            |
| stationId      | String   | FK → Workstation                                       |
| eventType      | String   | "working" / "idle" / "absent" / "product_count"        |
| confidence     | Float    | Model confidence score 0–1                             |
| count          | Int      | Units produced (only meaningful for product_count)      |
| idempotencyKey | String   | SHA-256(timestamp + workerId + stationId + eventType)  |

Indexes on `timestamp`, `workerId`, `stationId`.

---

## Metric Definitions

### Event Duration Model
Events are sorted per-worker by timestamp ascending. The duration of event *i* equals `timestamp[i+1] − timestamp[i]`. The **last** event of each worker is assigned a default duration of **15 minutes**.

### product_count Events
These are additive counters — the `count` field represents units produced. They are **not** time-based; they contribute zero duration but are summed per worker/station.

### Worker-Level Metrics
| Metric             | Formula                                                          |
|--------------------|------------------------------------------------------------------|
| totalActiveTimeSec | Sum of durations for "working" events                            |
| totalIdleTimeSec   | Sum of durations for "idle" events                               |
| totalAbsentTimeSec | Sum of durations for "absent" events                             |
| utilizationPct     | activeTime / (activeTime + idleTime) × 100                      |
| totalUnitsProduced | Sum of count for "product_count" events                          |
| unitsPerHour       | totalUnitsProduced / (totalActiveTimeSec / 3600)                 |
| primaryStation     | Station where the worker appeared most frequently                |

### Station-Level Metrics
| Metric            | Formula                                                           |
|-------------------|-------------------------------------------------------------------|
| occupancyTimeSec  | Total time any worker was "working" at this station               |
| utilizationPct    | occupancyTimeSec / 28800 × 100 (8-hr shift = 28 800 s)           |
| totalUnitsProduced| Sum of all product_count events at this station                   |
| throughputPerHour | totalUnitsProduced / 8                                            |

### Factory-Level Metrics
| Metric                  | Formula                                            |
|-------------------------|----------------------------------------------------|
| totalProductiveTimeSec  | Sum of all workers' active time                    |
| totalProductionCount    | Sum of all product_count events                    |
| avgProductionRatePerHour| totalProductionCount / 8                           |
| avgWorkerUtilizationPct | Average of all 6 workers' utilizationPct           |
| activeWorkers           | Workers with utilizationPct > 0                    |
| topPerformingWorker     | Worker with highest totalUnitsProduced              |

---

## API Reference

### `GET /health`
```json
{ "status": "ok", "timestamp": "2026-01-15T12:00:00.000Z" }
```

### `POST /api/events/ingest`
Accepts a single event or an array.

**Request:**
```json
{
  "timestamp": "2026-01-15T10:15:00Z",
  "worker_id": "W1",
  "workstation_id": "S3",
  "event_type": "working",
  "confidence": 0.93,
  "count": 1
}
```

**Response:**
```json
{ "accepted": 1, "skipped": 0, "total": 1 }
```

### `GET /api/metrics`
Query params (all optional): `worker_id`, `station_id`, `from`, `to`.

**Response:**
```json
{
  "factory": { "totalProductiveTimeSec": 72000, "..." : "..." },
  "workers": [ { "workerId": "W1", "..." : "..." } ],
  "stations": [ { "stationId": "S1", "..." : "..." } ],
  "generatedAt": "2026-01-15T16:00:00.000Z"
}
```

### `POST /api/seed`
**Request:**
```json
{ "clear": true }
```

**Response:**
```json
{ "message": "Seeded successfully", "eventCount": 312 }
```

---

## Handling Edge Cases

### Duplicate Events
Every event is hashed with SHA-256(`timestamp + worker_id + station_id + event_type`) and stored as a unique `idempotencyKey`. If a duplicate arrives, Prisma's unique constraint triggers error `P2002`, which the ingestion route silently skips — the event is counted as `skipped` in the response.

### Out-of-Order Timestamps
All metric queries `ORDER BY timestamp ASC`. A separate `receivedAt` field records server receipt time, so ingestion order and event order are decoupled.

### Intermittent Connectivity
Edge devices (cameras) should:
1. Buffer events locally in a durable queue.
2. Batch POST arrays of events when connectivity is restored.
3. Use exponential backoff (initial 1 s, max 60 s) on transient failures.
4. Rely on idempotency keys — safe to retry without risk of double-counting.

---

## Model Versioning & Drift Detection

To support evolving computer-vision models:

1. **`model_version` field** — Add to the Event table so every event records which model version produced it.
2. **Per-version confidence tracking** — Compute rolling distributions of `confidence` scores grouped by `model_version`.
3. **Drift alerting** — If the 7-day rolling average confidence for the active model version drops > 10% below its baseline (first 7-day average after deployment), trigger an alert.
4. **Retraining webhook** — When the drift threshold is breached, fire a POST to a configurable webhook URL to kick off the retraining pipeline.

---

## Scaling Strategy

| Scale          | Approach                                                                 |
|----------------|--------------------------------------------------------------------------|
| **5 cameras**  | Current architecture (SQLite + single Express instance) handles this easily. |
| **100+ cameras** | Replace direct DB writes with a message queue (Kafka / SQS). Async consumers batch-insert events. Switch to PostgreSQL for concurrent writes. |
| **Multi-site** | Add `site_id` to all entities. Run PostgreSQL per site. Use ClickHouse or TimescaleDB for cross-site analytics. Add an aggregation API layer. |

---

## Assumptions & Tradeoffs

1. **Duration of the last event** — Assumed 15 minutes. In production, a "shift end" sentinel event would be more accurate.
2. **Utilization excludes absent time** — A worker marked absent is neither productive nor idle; they are simply not on the floor.
3. **product_count is additive** — Each product_count event's `count` is summed directly. There is no deduplication beyond the idempotency key.
4. **Single shift** — Metric computation assumes a single 8-hour shift (28 800 seconds). Multi-shift support would require shift-boundary configuration.
5. **SQLite for development** — Chosen for zero-config local development. PostgreSQL is recommended for production (concurrent writes, better indexing).
6. **No authentication** — The seed and ingest endpoints are open. In production, add JWT or API-key middleware.
7. **Confidence threshold not filtered** — All events are accepted regardless of confidence score. A production system would filter low-confidence events or flag them for review.
