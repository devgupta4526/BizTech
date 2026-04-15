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

const corsOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean)
  : null;

app.use(
  cors({
    origin:
      corsOrigins && corsOrigins.length > 0
        ? (origin, cb) => {
            if (!origin) return cb(null, true);
            const normalized = origin.replace(/\/+$/, "");
            if (corsOrigins.includes(normalized)) return cb(null, true);
            return cb(null, false);
          }
        : true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/events", eventsRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/seed", seedRouter);

async function bootstrap() {
  try {
    logger.info("Running Prisma migrations …");
    execSync("npx prisma migrate deploy", {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
    });
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      logger.error(err, "Prisma migrate deploy failed in production");
      throw err;
    }
    logger.warn("migrate deploy failed — attempting prisma db push (dev only) …");
    execSync("npx prisma db push", {
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
