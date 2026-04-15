const { Router } = require("express");
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const { z } = require("zod");
const pino = require("pino");

const router = Router();
const prisma = new PrismaClient();
const logger = pino({ name: "events" });

const eventSchema = z.object({
  timestamp: z.string(),
  worker_id: z.string(),
  workstation_id: z.string(),
  event_type: z.enum(["working", "idle", "absent", "product_count"]),
  confidence: z.number().min(0).max(1),
  count: z.number().int().min(0).default(0),
});

function makeKey(timestamp, workerId, stationId, eventType) {
  return crypto
    .createHash("sha256")
    .update(`${timestamp}${workerId}${stationId}${eventType}`)
    .digest("hex");
}

router.post("/ingest", async (req, res) => {
  try {
    const raw = Array.isArray(req.body) ? req.body : [req.body];
    let accepted = 0;
    let skipped = 0;

    for (const item of raw) {
      const parsed = eventSchema.safeParse(item);
      if (!parsed.success) {
        skipped++;
        continue;
      }

      const evt = parsed.data;
      const idempotencyKey = makeKey(
        evt.timestamp,
        evt.worker_id,
        evt.workstation_id,
        evt.event_type
      );

      try {
        await prisma.event.create({
          data: {
            timestamp: new Date(evt.timestamp),
            workerId: evt.worker_id,
            stationId: evt.workstation_id,
            eventType: evt.event_type,
            confidence: evt.confidence,
            count: evt.count,
            idempotencyKey,
          },
        });
        accepted++;
        logger.info({ workerId: evt.worker_id, eventType: evt.event_type }, "Event ingested");
      } catch (err) {
        if (err.code === "P2002") {
          skipped++;
          continue;
        }
        throw err;
      }
    }

    return res.status(200).json({ accepted, skipped, total: raw.length });
  } catch (err) {
    logger.error(err, "Failed to ingest events");
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
