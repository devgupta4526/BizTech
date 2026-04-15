const { Router } = require("express");
const { seed } = require("../../prisma/seed");
const pino = require("pino");

const router = Router();
const logger = pino({ name: "seed" });

router.post("/", async (req, res) => {
  try {
    const clear = req.body?.clear === true;
    const eventCount = await seed({ clear });
    logger.info({ eventCount, clear }, "Seed completed");
    return res.status(200).json({ message: "Seeded successfully", eventCount });
  } catch (err) {
    logger.error(err, "Seed failed");
    return res.status(500).json({ error: "Seed failed" });
  }
});

module.exports = router;
