require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pino = require("pino");
const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");
const path = require("path");

const eventsRouter = require("./routes/events");
const metricsRouter = require("./routes/metrics");
const seedRouter = require("./routes/seed");
const { seed } = require("../prisma/seed");

const app = express();
const prisma = new PrismaClient();
const logger = pino({ name: "server" });
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/events", eventsRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/seed", seedRouter);

async function bootstrap() {
  try {
    // Run migrations
    logger.info("Running Prisma migrations …");
    execSync("npx prisma migrate deploy", {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
    });
  } catch {
    logger.warn("Prisma migrate deploy failed — attempting db push …");
    execSync("npx prisma db push --accept-data-loss", {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
    });
  }

  // Auto-seed when events table is empty
  const count = await prisma.event.count();
  if (count === 0) {
    logger.info("No events found — auto-seeding …");
    const created = await seed();
    logger.info(`Auto-seeded ${created} events`);
  } else {
    logger.info(`Database has ${count} events — skipping seed`);
  }

  app.listen(PORT, () => {
    logger.info(`Server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.error(err, "Bootstrap failed");
  process.exit(1);
});
