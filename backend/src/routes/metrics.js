const { Router } = require("express");
const { computeMetrics } = require("../lib/computeMetrics");
const pino = require("pino");

const router = Router();
const logger = pino({ name: "metrics" });

router.get("/", async (req, res) => {
  try {
    const filters = {};
    if (req.query.worker_id) filters.worker_id = req.query.worker_id;
    if (req.query.station_id) filters.station_id = req.query.station_id;
    if (req.query.from) filters.from = req.query.from;
    if (req.query.to) filters.to = req.query.to;

    const result = await computeMetrics(filters);
    logger.info("Metrics served");
    return res.status(200).json(result);
  } catch (err) {
    logger.error(err, "Failed to compute metrics");
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
