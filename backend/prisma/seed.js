const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

const WORKERS = [
  { id: "W1", name: "Arjun Sharma" },
  { id: "W2", name: "Priya Nair" },
  { id: "W3", name: "Ravi Kumar" },
  { id: "W4", name: "Meena Patel" },
  { id: "W5", name: "Suresh Raj" },
  { id: "W6", name: "Divya Menon" },
];

const WORKSTATIONS = [
  { id: "S1", name: "Assembly Line A", stationType: "assembly" },
  { id: "S2", name: "Assembly Line B", stationType: "assembly" },
  { id: "S3", name: "Welding Station", stationType: "welding" },
  { id: "S4", name: "Quality Control", stationType: "inspection" },
  { id: "S5", name: "Packaging Unit", stationType: "packaging" },
  { id: "S6", name: "Material Handling", stationType: "logistics" },
];

const PRIMARY_STATIONS = {
  W1: "S1",
  W2: "S2",
  W3: "S3",
  W4: "S4",
  W5: "S5",
  W6: "S6",
};

function makeKey(timestamp, workerId, stationId, eventType) {
  return crypto
    .createHash("sha256")
    .update(`${timestamp}${workerId}${stationId}${eventType}`)
    .digest("hex");
}

function pickStation(workerId) {
  const primary = PRIMARY_STATIONS[workerId];
  if (Math.random() < 0.75) return primary;
  const others = WORKSTATIONS.filter((s) => s.id !== primary);
  return others[Math.floor(Math.random() * others.length)].id;
}

function pickEventType() {
  const r = Math.random();
  if (r < 0.6) return "working";
  if (r < 0.8) return "idle";
  if (r < 0.9) return "absent";
  return "product_count";
}

/** Random gap between events: 5–15 minutes (inclusive), per spec. */
function randomInterval() {
  const minutes = 5 + Math.floor(Math.random() * 11);
  return minutes * 60 * 1000;
}

function generateEvents() {
  const shiftStart = new Date("2026-01-15T08:00:00Z");
  const shiftEnd = new Date("2026-01-15T16:00:00Z");
  const events = [];

  for (const worker of WORKERS) {
    let cursor = new Date(shiftStart.getTime());
    while (cursor < shiftEnd) {
      const stationId = pickStation(worker.id);
      const eventType = pickEventType();
      const confidence = +(0.75 + Math.random() * 0.25).toFixed(2);
      const count = eventType === "product_count" ? 1 + Math.floor(Math.random() * 8) : 0;
      const ts = cursor.toISOString();

      events.push({
        timestamp: cursor,
        workerId: worker.id,
        stationId,
        eventType,
        confidence,
        count,
        idempotencyKey: makeKey(ts, worker.id, stationId, eventType),
      });

      cursor = new Date(cursor.getTime() + randomInterval());
    }
  }

  return events;
}

async function seed({ clear = false } = {}) {
  for (const w of WORKERS) {
    await prisma.worker.upsert({
      where: { id: w.id },
      update: { name: w.name },
      create: w,
    });
  }

  for (const s of WORKSTATIONS) {
    await prisma.workstation.upsert({
      where: { id: s.id },
      update: { name: s.name, stationType: s.stationType },
      create: s,
    });
  }

  if (clear) {
    await prisma.event.deleteMany();
  }

  const events = generateEvents();
  let created = 0;

  for (const evt of events) {
    try {
      await prisma.event.upsert({
        where: { idempotencyKey: evt.idempotencyKey },
        update: {},
        create: evt,
      });
      created++;
    } catch (err) {
      if (err.code === "P2002") continue;
      throw err;
    }
  }

  return created;
}

async function main() {
  console.log("Seeding database …");
  const count = await seed();
  console.log(`Seeded ${count} events.`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { seed, WORKERS, WORKSTATIONS };
