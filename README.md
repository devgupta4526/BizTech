# Factory Productivity Dashboard

An AI-powered CCTV worker monitoring dashboard that ingests machine-vision events from factory cameras and presents real-time productivity metrics for workers, workstations, and the factory as a whole.

---

## Quick Start

### Local Development (without Docker)

```bash
# 1. Copy env template and set DATABASE_URL to your Neon connection string
cd backend
cp .env.example .env
# Edit .env — use Neon "Pooled" connection string, sslmode=require

# 2. Install dependencies
npm install

# 3. Generate Prisma client & apply migrations to Neon
npx prisma generate
npx prisma migrate deploy

# 4. Seed the database (optional if you will rely on API auto-seed on empty DB)
node prisma/seed.js

# 5. Start the API server (port 3001)
node src/index.js

# 6. In a new terminal — frontend
cd frontend
npm install
# For local UI talking to local API, default Vite proxy is fine (no .env needed).
npm run dev
```

### Docker Compose

Create `backend/.env` with `DATABASE_URL` pointing at Neon (same as local). Then:

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Health check: http://localhost:3001/health

On first boot the backend runs `prisma migrate deploy` and auto-seeds if the events table is empty.

---

## Deploy (Neon + Render + Vercel)

**Secrets:** Never commit `DATABASE_URL` or database passwords. Store them in the Render / Vercel dashboards only. If a connection string was shared in chat, email, or a ticket, **rotate the Neon password** in the Neon project settings.

### 1. Neon (PostgreSQL)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the **pooled** `postgresql://…` connection string (SSL on).
3. If Node/Prisma fails to connect, try the same URL with **`channel_binding=require` removed** (some drivers disagree with the pooler).

### 2. Render (backend API)

1. New **Web Service** → connect this repo, **Root Directory**: `backend`.
2. **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy`
3. **Start Command:** `node src/index.js`
4. **Environment variables:**
   - `DATABASE_URL` — your Neon URL (secret).
   - `NODE_ENV` — `production`
   - `FRONTEND_URL` — your Vercel site URL, e.g. `https://your-app.vercel.app` (comma-separate multiple origins if needed).
5. After deploy, note the service URL, e.g. `https://factory-dashboard-api.onrender.com`.

Optional: connect the repo and use `backend/render.yaml` as a [Blueprint](https://render.com/docs/blueprint-spec); still set `DATABASE_URL` and `FRONTEND_URL` in the dashboard.

### 3. Vercel (frontend)

1. New Project → import repo, **Root Directory**: `frontend`, Framework Preset: **Vite**.
2. **Environment variable (required for production API calls):**
   - `VITE_API_URL` = `https://YOUR-RENDER-SERVICE.onrender.com/api` (use your real Render URL).
3. Deploy. The dashboard will call the Render API; CORS is allowed only for `FRONTEND_URL` on the backend, so keep those two in sync.

### 4. First-time database

After the first successful Render deploy with `DATABASE_URL`, migrations create tables. On first request, if there are no events, the server auto-seeds. You can also run `POST /api/seed` from the UI or curl.

---

## Architecture

```
Edge (CCTV cameras)
       │
       ▼
POST /api/events/ingest   ←── JSON event payloads
       │
       ▼
   PostgreSQL (Prisma ORM, e.g. Neon)
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
| **5 cameras**  | Current architecture (PostgreSQL + single Express instance) handles this easily. |
| **100+ cameras** | Replace direct DB writes with a message queue (Kafka / SQS). Async consumers batch-insert events. Switch to PostgreSQL for concurrent writes. |
| **Multi-site** | Add `site_id` to all entities. Run PostgreSQL per site. Use ClickHouse or TimescaleDB for cross-site analytics. Add an aggregation API layer. |

---

## Assumptions & Tradeoffs

1. **Duration of the last event** — Assumed 15 minutes. In production, a "shift end" sentinel event would be more accurate.
2. **Utilization excludes absent time** — A worker marked absent is neither productive nor idle; they are simply not on the floor.
3. **product_count is additive** — Each product_count event's `count` is summed directly. There is no deduplication beyond the idempotency key.
4. **Single shift** — Metric computation assumes a single 8-hour shift (28 800 seconds). Multi-shift support would require shift-boundary configuration.
5. **PostgreSQL (Neon)** — Local and production use the same Prisma schema; use a pooled Neon URL in `DATABASE_URL` for serverless-friendly connections.
6. **No authentication** — The seed and ingest endpoints are open. In production, add JWT or API-key middleware.
7. **Confidence threshold not filtered** — All events are accepted regardless of confidence score. A production system would filter low-confidence events or flag them for review.
