// Demo seed — populates the database with realistic HK ENV. data so the
// app can be walked through end-to-end for QA or a client demo.
//
// Idempotent: wipes everything previously created by this script (anything
// tagged with the DEMO_TAG), then rebuilds. The Phase 1 minimal seed (the
// real Owner account) is preserved so /admin/users still shows your real
// account next to the demo accounts.

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const DEMO_TAG = "demo";
const PASSWORD = "DemoPass!2026";

async function main() {
  // Prefer a direct connection if available — the seed runs a long
  // interactive transaction that doesn't play nicely with PgBouncer
  // transaction-mode pooling (Supabase port 6543).
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (or DIRECT_URL) is not set.");
  const prismaClient = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  console.log("Demo seed: wiping prior demo data…");
  await wipeDemo(prismaClient);

  console.log("Demo seed: building fresh demo dataset…");

  // Wrap all the build-up writes in one long-lived interactive transaction.
  // The prisma-dev local Postgres proxy drops postgres extended-query
  // portals between separate Prisma calls; one tx keeps everything on a
  // single session and dodges that quirk. 5 min timeout is more than
  // enough — the seed runs in well under a minute on any real Postgres.
  await prismaClient.$transaction(
    async (prisma) => {
      await buildDemoData(prisma as unknown as PrismaClient);
    },
    { timeout: 5 * 60 * 1000, maxWait: 10_000 },
  );

  await prismaClient.$disconnect();
}

async function buildDemoData(prisma: PrismaClient) {

  // ---- Counters ----
  await prisma.systemCounter.upsert({
    where: { key: "employeeId" },
    create: { key: "employeeId", value: 0 },
    update: {},
  });
  await prisma.systemCounter.upsert({
    where: { key: "ticketNumber" },
    create: { key: "ticketNumber", value: 100000 },
    update: {},
  });

  // ---- Users (Owners, Admins, Operators) ----
  const pwd = await bcrypt.hash(PASSWORD, 10);

  const jarnail = await ensureOwner(prisma);

  const helena = await createUser(prisma, {
    name: "Helena Reyes",
    email: "helena.owner@demo.hkenv.local",
    role: "OWNER",
    pwd,
  });

  const sarah = await createUser(prisma, {
    name: "Sarah Patel",
    email: "sarah.admin@demo.hkenv.local",
    role: "ADMIN",
    pwd,
  });
  const mike = await createUser(prisma, {
    name: "Mike Donovan",
    email: "mike.admin@demo.hkenv.local",
    role: "ADMIN",
    pwd,
  });

  const operators = await Promise.all([
    createOperator(prisma, { name: "Olin Larsen",   email: "olin.op@demo.hkenv.local",   pwd, phone: "(416) 555-0101", licence: "AZ" }),
    createOperator(prisma, { name: "Priya Singh",   email: "priya.op@demo.hkenv.local",  pwd, phone: "(416) 555-0102", licence: "AZ" }),
    createOperator(prisma, { name: "Chen Liu",      email: "chen.op@demo.hkenv.local",   pwd, phone: "(416) 555-0103", licence: "DZ" }),
    createOperator(prisma, { name: "Maria Costa",   email: "maria.op@demo.hkenv.local",  pwd, phone: "(416) 555-0104", licence: "AZ" }),
    createOperator(prisma, { name: "Sam Whitfield", email: "sam.op@demo.hkenv.local",    pwd, phone: "(416) 555-0105", licence: "DZ" }),
  ]);
  const [olin, priya, chen, maria, sam] = operators;
  void maria; void sam;

  // ---- Trucks ----
  const trucks = await Promise.all([
    createTruck(prisma, { plate: "DEMO-AY-1801", type: "TRI_AXLE",    cap: 28, colour: "Red",   status: "ACTIVE" }),
    createTruck(prisma, { plate: "DEMO-BX-2204", type: "END_DUMP",    cap: 35, colour: "White", status: "ACTIVE" }),
    createTruck(prisma, { plate: "DEMO-CK-9970", type: "TRI_AXLE",    cap: 28, colour: "Blue",  status: "ACTIVE" }),
    createTruck(prisma, { plate: "DEMO-LB-4422", type: "LIVE_BOTTOM", cap: 40, colour: "Yellow", status: "ACTIVE" }),
    createTruck(prisma, { plate: "DEMO-FL-7301", type: "FLOAT",       cap: 50, colour: "Black", status: "MAINTENANCE" }),
    createTruck(prisma, { plate: "DEMO-AY-3320", type: "TRI_AXLE",    cap: 28, colour: "White", status: "ACTIVE" }),
  ]);
  const [t1, t2, t3, t4, , t6] = trucks;

  // Current assignments: pair operators with trucks
  await prisma.truck.update({ where: { id: t1.id }, data: { assignedOperatorId: olin.id } });
  await prisma.truck.update({ where: { id: t2.id }, data: { assignedOperatorId: priya.id } });
  await prisma.truck.update({ where: { id: t3.id }, data: { assignedOperatorId: chen.id } });
  await prisma.truck.update({ where: { id: t4.id }, data: { assignedOperatorId: maria.id } });
  await prisma.truck.update({ where: { id: t6.id }, data: { assignedOperatorId: sam.id } });

  // ---- Projects ----
  const today = startOfDay(new Date());
  const project1 = await prisma.project.create({
    data: {
      name: "Don Mills Reconstruction — Demo",
      client: "City of Toronto",
      address: "Don Mills Rd & Eglinton Ave, Toronto",
      startDate: daysAgo(14),
      endDate: daysFromNow(60),
      materialBudget: 320_000,
      loadTarget: 480,
      scheduleNotes: "Mon–Fri 6:30 AM start. Pickup at the Brockton yard.",
      status: "ACTIVE",
    },
  });
  const project2 = await prisma.project.create({
    data: {
      name: "Brock Rd Landfill Haul — Demo",
      client: "Region of Peel",
      address: "Brock Rd N, Pickering",
      startDate: daysAgo(5),
      endDate: null,
      materialBudget: 95_000,
      loadTarget: 120,
      scheduleNotes: "Open-ended; runs as material becomes available.",
      status: "ACTIVE",
    },
  });
  const project3 = await prisma.project.create({
    data: {
      name: "Yonge & Sheppard Cleanup — Demo",
      client: "Metrolinx",
      address: "Yonge & Sheppard, North York",
      startDate: daysAgo(90),
      endDate: daysAgo(30),
      materialBudget: 220_000,
      loadTarget: 300,
      scheduleNotes: "Wrapped. Closed out 30 days ago.",
      status: "COMPLETED",
    },
  });

  // ---- Project assignments ----
  await prisma.operatorOnProject.createMany({
    data: [
      { projectId: project1.id, operatorId: olin.id },
      { projectId: project1.id, operatorId: priya.id },
      { projectId: project1.id, operatorId: chen.id },
      { projectId: project2.id, operatorId: maria.id },
      { projectId: project2.id, operatorId: sam.id },
      { projectId: project3.id, operatorId: olin.id },
      { projectId: project3.id, operatorId: priya.id },
    ],
  });
  await prisma.truckOnProject.createMany({
    data: [
      { projectId: project1.id, truckId: t1.id },
      { projectId: project1.id, truckId: t2.id },
      { projectId: project1.id, truckId: t3.id },
      { projectId: project2.id, truckId: t4.id },
      { projectId: project2.id, truckId: t6.id },
    ],
  });

  // ---- Dispatches (varied states) ----
  // Yesterday — fully completed with tickets
  const yesterdayDispatches = await Promise.all([
    createDispatch(prisma, {
      project: project1, operator: olin, truck: t1,
      scheduledFor: hoursAgo(28), pickup: "Brockton Yard, Bay 4", dump: "Beare Rd Landfill",
      acceptance: "ACCEPTED", status: "COMPLETED", createdBy: sarah, completedAt: hoursAgo(20),
      startedAt: hoursAgo(27), notes: "Demo: smooth day, all loads ran on time.",
    }),
    createDispatch(prisma, {
      project: project1, operator: priya, truck: t2,
      scheduledFor: hoursAgo(27), pickup: "Brockton Yard, Bay 4", dump: "Beare Rd Landfill",
      acceptance: "ACCEPTED", status: "COMPLETED", createdBy: sarah, completedAt: hoursAgo(19),
      startedAt: hoursAgo(26),
    }),
    createDispatch(prisma, {
      project: project2, operator: maria, truck: t4,
      scheduledFor: hoursAgo(26), pickup: "Pickering Aggregates", dump: "Brock Rd Landfill",
      acceptance: "ACCEPTED", status: "COMPLETED", createdBy: mike, completedAt: hoursAgo(18),
      startedAt: hoursAgo(25),
    }),
  ]);

  // Earlier this week — completed dispatches
  for (let dayOffset = 2; dayOffset <= 5; dayOffset++) {
    await createDispatch(prisma, {
      project: project1, operator: olin, truck: t1,
      scheduledFor: daysAgo(dayOffset), pickup: "Brockton Yard, Bay 4", dump: "Beare Rd Landfill",
      acceptance: "ACCEPTED", status: "COMPLETED", createdBy: sarah,
      completedAt: addHours(daysAgo(dayOffset), 8), startedAt: addHours(daysAgo(dayOffset), 1),
    });
    await createDispatch(prisma, {
      project: project1, operator: chen, truck: t3,
      scheduledFor: daysAgo(dayOffset), pickup: "Brockton Yard, Bay 4", dump: "Beare Rd Landfill",
      acceptance: "ACCEPTED", status: "COMPLETED", createdBy: sarah,
      completedAt: addHours(daysAgo(dayOffset), 7), startedAt: addHours(daysAgo(dayOffset), 1),
    });
  }

  // Today — one in-progress, one accepted-not-started, one flagged
  const todayInProgress = await createDispatch(prisma, {
    project: project1, operator: priya, truck: t2,
    scheduledFor: hoursAgo(3), pickup: "Brockton Yard, Bay 4", dump: "Beare Rd Landfill",
    acceptance: "ACCEPTED", status: "EN_ROUTE_TO_DUMP", createdBy: sarah,
    startedAt: hoursAgo(2),
  });
  await createDispatch(prisma, {
    project: project2, operator: maria, truck: t4,
    scheduledFor: hoursAgo(1), pickup: "Pickering Aggregates", dump: "Brock Rd Landfill",
    acceptance: "ACCEPTED", status: "IDLE", createdBy: mike,
  });
  const flaggedDispatch = await createDispatch(prisma, {
    project: project2, operator: sam, truck: t6,
    scheduledFor: hoursAgo(2), pickup: "Pickering Aggregates", dump: "Brock Rd Landfill",
    acceptance: "FLAGGED", status: "IDLE", createdBy: mike,
    flagReason: "Truck overheating warning light — needs check before I start.",
    flaggedAt: hoursAgo(1),
  });
  void flaggedDispatch;

  // Tomorrow — pending acceptance
  for (const op of [olin, priya, chen]) {
    const truck = op.id === olin.id ? t1 : op.id === priya.id ? t2 : t3;
    await createDispatch(prisma, {
      project: project1, operator: op, truck,
      scheduledFor: addHours(today, 30), pickup: "Brockton Yard, Bay 4", dump: "Beare Rd Landfill",
      acceptance: "PENDING", status: "IDLE", createdBy: sarah,
    });
  }

  // ---- Trips for the completed dispatches (with GPS paths) ----
  for (const d of yesterdayDispatches) {
    await createTrip(prisma, d, torontoPath());
  }

  // ---- Tickets ----
  let ticketCounter = 100001;
  function nextTicketNumber(): string {
    return `T-${String(ticketCounter++).padStart(6, "0")}`;
  }
  // Bump the SystemCounter past our manually-set ticket numbers so future
  // tickets continue sequentially.
  async function syncTicketCounter() {
    await prisma.systemCounter.update({
      where: { key: "ticketNumber" },
      data: { value: ticketCounter - 1 },
    });
  }

  const allCompleted = await prisma.dispatch.findMany({
    where: { status: "COMPLETED", notes: { contains: "Demo:" } },
    include: { project: true, operator: true, truck: true, trip: true },
  });
  // Also fetch the older completed dispatches (those without 'Demo:' marker)
  const moreCompleted = await prisma.dispatch.findMany({
    where: {
      status: "COMPLETED",
      project: { name: { contains: "— Demo" } },
      ticket: null,
    },
    include: { project: true, operator: true, truck: true, trip: true },
  });
  const allDone = [...allCompleted, ...moreCompleted.filter((d) => !allCompleted.find((x) => x.id === d.id))];

  // For each completed dispatch, create an APPROVED ticket
  const sig = makeFakeSignature();
  for (let i = 0; i < allDone.length; i++) {
    const d = allDone[i];
    const start = d.startedAt ?? d.scheduledFor;
    const end = d.completedAt ?? addHours(start, 7);
    const totalHours = (end.getTime() - start.getTime()) / 3_600_000;

    const isLastTwo = i >= allDone.length - 2; // the last two stay SUBMITTED to show the review queue
    const flagThis = i === 0; // one flagged
    let status: "SUBMITTED" | "APPROVED" | "FLAGGED" = isLastTwo
      ? "SUBMITTED"
      : flagThis
        ? "FLAGGED"
        : "APPROVED";

    const submittedAt = addHours(end, 0.5);
    const approvedAt = status === "APPROVED" ? addHours(submittedAt, 1) : null;

    const t = await prisma.ticket.create({
      data: {
        ticketNumber: nextTicketNumber(),
        date: start,
        brokerName: "BridgeBrokers Inc.",
        truckNumber: d.truck.licensePlate.replace("DEMO-", ""),
        licensePlate: d.truck.licensePlate,
        companyHaulingFor: d.project.client,
        jobContractNumber: `JC-${d.project.id.slice(-6).toUpperCase()}`,
        pickupLocation: d.pickupNote,
        deliveryLocation: d.dumpNote,
        equipmentType: d.truck.type,
        used407ETR: i % 3 === 0,
        startTime: start,
        endTime: end,
        totalHours: Math.round(totalHours * 100) / 100,
        materialType: i % 2 === 0 ? "Topsoil" : "Crushed stone 19mm",
        comments: i % 4 === 0 ? "Demo: ran a bit long due to gate traffic." : null,
        issuesNote: flagThis ? "Wrong delivery code on the manifest — recorded what I was given." : null,
        status,
        signatureDataUrl: sig,
        submittedAt,
        approvedAt,
        approvedById: status === "APPROVED" ? sarah.id : null,
        flaggedAt: status === "FLAGGED" ? addHours(submittedAt, 0.25) : null,
        flagReason: status === "FLAGGED" ? "Delivery code doesn't match the dispatch — need to verify." : null,
        flaggedById: status === "FLAGGED" ? sarah.id : null,
        dispatchId: d.id,
        projectId: d.projectId,
        operatorId: d.operatorId,
        truckId: d.truckId,
        loadEntries: {
          create: [
            { loadNumber: 1, loadTime: addHours(start, 1), notes: null },
            { loadNumber: 2, loadTime: addHours(start, 2.5), notes: i % 5 === 0 ? "Tarped" : null },
            { loadNumber: 3, loadTime: addHours(start, 4), notes: null },
            { loadNumber: 4, loadTime: addHours(start, 5.5), notes: null },
          ],
        },
      },
    });

    // Auto-raise flag exception for the flagged ticket
    if (status === "FLAGGED") {
      await prisma.exception.create({
        data: {
          type: "TICKET_FLAGGED",
          status: "PENDING",
          summary: `Ticket ${t.ticketNumber} flagged by admin`,
          details: "Delivery code doesn't match the dispatch — need to verify.",
          ticketId: t.id,
          createdById: sarah.id,
        },
      });
    }

    // For one historical APPROVED ticket, raise a late-submission exception
    // (already-resolved) to show the audit trail.
    if (i === 2 && status === "APPROVED") {
      await prisma.exception.create({
        data: {
          type: "TICKET_LATE_SUBMISSION",
          status: "APPROVED",
          summary: `Ticket ${t.ticketNumber} submitted 30h after haul date`,
          details: `Haul date: ${start.toISOString()}\nSubmitted: ${submittedAt.toISOString()}\nThreshold: 24h`,
          ticketId: t.id,
          decidedAt: addHours(submittedAt, 2),
          decidedById: jarnail.id,
          decisionNote: "Acknowledged — operator had no signal at the site, fine.",
        },
      });
    }
  }

  // Operator priya has a DRAFT ticket in progress (for the in-progress dispatch)
  await prisma.ticket.create({
    data: {
      ticketNumber: nextTicketNumber(),
      date: today,
      brokerName: "BridgeBrokers Inc.",
      truckNumber: todayInProgress.truckId === t2.id ? "BX-2204" : "—",
      licensePlate: t2.licensePlate,
      companyHaulingFor: project1.client,
      jobContractNumber: `JC-${project1.id.slice(-6).toUpperCase()}`,
      pickupLocation: todayInProgress.pickupNote,
      deliveryLocation: todayInProgress.dumpNote,
      equipmentType: t2.type,
      used407ETR: false,
      startTime: todayInProgress.startedAt,
      comments: null,
      status: "DRAFT",
      projectId: project1.id,
      operatorId: priya.id,
      truckId: t2.id,
    },
  });

  // One pending ADMIN_OVERRIDE_REQUEST so the Owner queue has something to act on
  const someApproved = await prisma.ticket.findFirst({
    where: { status: "APPROVED", ticketNumber: { startsWith: "T-" } },
    orderBy: { createdAt: "desc" },
  });
  if (someApproved) {
    await prisma.exception.create({
      data: {
        type: "ADMIN_OVERRIDE_REQUEST",
        status: "PENDING",
        summary: `Approve over-target loads on ${project1.name}`,
        details:
          "We're 12 loads past the contracted target for this week — client (City of Toronto) " +
          "is okay with it but I need your sign-off before billing the extra.",
        ticketId: someApproved.id,
        createdById: sarah.id,
      },
    });
  }

  await syncTicketCounter();

  const counts = {
    users: await prisma.user.count({ where: { email: { contains: "@demo.hkenv.local" } } }),
    trucks: await prisma.truck.count({ where: { licensePlate: { startsWith: "DEMO-" } } }),
    projects: await prisma.project.count({ where: { name: { contains: "— Demo" } } }),
    dispatches: await prisma.dispatch.count({ where: { project: { name: { contains: "— Demo" } } } }),
    trips: await prisma.trip.count({ where: { project: { name: { contains: "— Demo" } } } }),
    tickets: await prisma.ticket.count({ where: { project: { name: { contains: "— Demo" } } } }),
    exceptions: await prisma.exception.count({
      where: { OR: [
        { ticket: { project: { name: { contains: "— Demo" } } } },
        { summary: { contains: "Demo" } },
      ] },
    }),
  };

  console.log("");
  console.log("Demo seed complete:");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(12)} ${v}`);
  }
  console.log("");
  console.log("Demo accounts (password for all demo users: " + PASSWORD + "):");
  console.log("  Owner       helena.owner@demo.hkenv.local");
  console.log("  Admin       sarah.admin@demo.hkenv.local");
  console.log("  Admin       mike.admin@demo.hkenv.local");
  console.log("  Operator    olin.op@demo.hkenv.local");
  console.log("  Operator    priya.op@demo.hkenv.local  (has a draft ticket in progress)");
  console.log("  Operator    chen.op@demo.hkenv.local");
  console.log("  Operator    maria.op@demo.hkenv.local");
  console.log("  Operator    sam.op@demo.hkenv.local    (has a flagged dispatch)");
  console.log("");
  console.log("Real account (unchanged): owner@hkenv.local / ChangeMe!2026");
}

// --- Helpers --------------------------------------------------------------

const formatEmployeeId = (n: number) => `HK-${String(n).padStart(4, "0")}`;

async function ensureOwner(prisma: PrismaClient) {
  // Make sure the real Owner exists (the Phase 1 minimal seed); we link a
  // late-submission exception to them later for the audit trail.
  let owner = await prisma.user.findUnique({ where: { email: "owner@hkenv.local" } });
  if (owner) return owner;
  const counter = await prisma.systemCounter.update({
    where: { key: "employeeId" },
    data: { value: { increment: 1 } },
  });
  const hash = await bcrypt.hash("ChangeMe!2026", 10);
  owner = await prisma.user.create({
    data: {
      email: "owner@hkenv.local",
      name: "HK Owner",
      role: "OWNER",
      employeeId: formatEmployeeId(counter.value),
      passwordHash: hash,
      isActive: true,
    },
  });
  return owner;
}

async function createUser(
  prisma: PrismaClient,
  args: { name: string; email: string; role: "OWNER" | "ADMIN"; pwd: string },
) {
  const counter = await prisma.systemCounter.update({
    where: { key: "employeeId" },
    data: { value: { increment: 1 } },
  });
  return prisma.user.create({
    data: {
      email: args.email,
      name: args.name,
      role: args.role,
      employeeId: formatEmployeeId(counter.value),
      passwordHash: args.pwd,
      isActive: true,
    },
  });
}

async function createOperator(
  prisma: PrismaClient,
  args: { name: string; email: string; pwd: string; phone: string; licence: "AZ" | "DZ" },
) {
  const counter = await prisma.systemCounter.update({
    where: { key: "employeeId" },
    data: { value: { increment: 1 } },
  });
  const user = await prisma.user.create({
    data: {
      email: args.email,
      name: args.name,
      role: "OPERATOR",
      employeeId: formatEmployeeId(counter.value),
      passwordHash: args.pwd,
      isActive: true,
      operator: { create: { phone: args.phone, licenceClass: args.licence } },
    },
    include: { operator: true },
  });
  return user.operator!;
}

type TruckArgs = {
  plate: string;
  type: "TRI_AXLE" | "END_DUMP" | "LIVE_BOTTOM" | "FLOAT";
  cap: number;
  colour: string;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
};
async function createTruck(prisma: PrismaClient, a: TruckArgs) {
  return prisma.truck.create({
    data: {
      licensePlate: a.plate,
      type: a.type,
      capacityTonnes: a.cap,
      colour: a.colour,
      status: a.status,
    },
  });
}

type DispatchArgs = {
  project: { id: string };
  operator: { id: string };
  truck: { id: string };
  scheduledFor: Date;
  pickup: string;
  dump: string;
  acceptance: "PENDING" | "ACCEPTED" | "FLAGGED";
  status: "IDLE" | "EN_ROUTE_TO_PICKUP" | "LOADING" | "EN_ROUTE_TO_DUMP" | "COMPLETED" | "CANCELLED";
  createdBy: { id: string };
  startedAt?: Date | null;
  completedAt?: Date | null;
  notes?: string | null;
  flagReason?: string | null;
  flaggedAt?: Date | null;
};
async function createDispatch(prisma: PrismaClient, a: DispatchArgs) {
  return prisma.dispatch.create({
    data: {
      projectId: a.project.id,
      operatorId: a.operator.id,
      truckId: a.truck.id,
      scheduledFor: a.scheduledFor,
      pickupNote: a.pickup,
      dumpNote: a.dump,
      notes: a.notes ?? null,
      acceptance: a.acceptance,
      acceptedAt: a.acceptance === "ACCEPTED" ? new Date(a.scheduledFor.getTime() - 60 * 60 * 1000) : null,
      flagReason: a.flagReason ?? null,
      flaggedAt: a.flaggedAt ?? null,
      status: a.status,
      startedAt: a.startedAt ?? null,
      completedAt: a.completedAt ?? null,
      createdById: a.createdBy.id,
    },
  });
}

async function createTrip(
  prisma: PrismaClient,
  dispatch: {
    id: string;
    operatorId: string;
    truckId: string;
    projectId: string;
    pickupNote: string | null;
    dumpNote: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
  },
  path: Array<{ lat: number; lng: number }>,
) {
  const start = dispatch.startedAt ?? new Date();
  const end = dispatch.completedAt ?? new Date();
  const trip = await prisma.trip.create({
    data: {
      dispatchId: dispatch.id,
      operatorId: dispatch.operatorId,
      truckId: dispatch.truckId,
      projectId: dispatch.projectId,
      pickupNote: dispatch.pickupNote,
      dumpNote: dispatch.dumpNote,
      startedAt: start,
      endedAt: end,
      startLatitude: path[0]!.lat,
      startLongitude: path[0]!.lng,
      endLatitude: path[path.length - 1]!.lat,
      endLongitude: path[path.length - 1]!.lng,
      pointCount: path.length,
      totalDistanceM: estimateDistance(path),
    },
  });
  const span = end.getTime() - start.getTime();
  const step = span / Math.max(1, path.length - 1);
  await prisma.tripPoint.createMany({
    data: path.map((p, i) => ({
      tripId: trip.id,
      recordedAt: new Date(start.getTime() + step * i),
      latitude: p.lat,
      longitude: p.lng,
    })),
  });
  return trip;
}

// Synthetic GPS path: pickup → dump around Toronto. Realistic enough for
// the map replay demo.
function torontoPath(): Array<{ lat: number; lng: number }> {
  // From a yard near Brockton to a landfill in Pickering, ~20 points
  const pts: Array<{ lat: number; lng: number }> = [];
  const start = { lat: 43.6477, lng: -79.4395 }; // Brockton
  const end = { lat: 43.8359, lng: -79.0577 };  // Pickering area
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const lat = start.lat + (end.lat - start.lat) * t + (Math.sin(t * Math.PI * 3) * 0.002);
    const lng = start.lng + (end.lng - start.lng) * t + (Math.cos(t * Math.PI * 2) * 0.002);
    pts.push({ lat, lng });
  }
  return pts;
}

function estimateDistance(path: Array<{ lat: number; lng: number }>): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(x));
  }
  return Math.round(total);
}

// 24×24 black "X" PNG — stands in for an operator signature
function makeFakeSignature(): string {
  return (
    "data:image/png;base64," +
    "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYAQMAAADaua+7AAAABlBMVEUAAAD///+l2Z/dAAAAAnRSTlMAAQGU/a4AAAAtSURBVAjXY/jPwMDA8B+ICRgYBBl+/n9o+P+RgYGBgYGB4f//xv8MjAwM" +
    "DAwAFL0DAj1eGu4AAAAASUVORK5CYII="
  );
}

// --- Date helpers ---------------------------------------------------------

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}
function addHours(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60 * 60 * 1000);
}

// --- Wipe helper ----------------------------------------------------------

async function wipeDemo(prisma: PrismaClient) {
  // Order matters: delete children before parents to satisfy FKs.
  // Most demo data is tagged via email/name/plate; the cascade does the rest.
  await prisma.exception.deleteMany({
    where: {
      OR: [
        { ticket: { project: { name: { contains: "— Demo" } } } },
        { summary: { contains: "Demo" } },
        { summary: { contains: "— Demo" } },
      ],
    },
  });
  await prisma.ticketPhoto.deleteMany({
    where: { ticket: { project: { name: { contains: "— Demo" } } } },
  });
  await prisma.ticketLoadEntry.deleteMany({
    where: { ticket: { project: { name: { contains: "— Demo" } } } },
  });
  await prisma.ticket.deleteMany({
    where: { project: { name: { contains: "— Demo" } } },
  });
  await prisma.tripPoint.deleteMany({
    where: { trip: { project: { name: { contains: "— Demo" } } } },
  });
  await prisma.trip.deleteMany({
    where: { project: { name: { contains: "— Demo" } } },
  });
  await prisma.dispatch.deleteMany({
    where: { project: { name: { contains: "— Demo" } } },
  });
  await prisma.projectDocument.deleteMany({
    where: { project: { name: { contains: "— Demo" } } },
  });
  await prisma.truckOnProject.deleteMany({
    where: { project: { name: { contains: "— Demo" } } },
  });
  await prisma.operatorOnProject.deleteMany({
    where: { project: { name: { contains: "— Demo" } } },
  });
  await prisma.project.deleteMany({
    where: { name: { contains: "— Demo" } },
  });
  await prisma.truckAssignmentEvent.deleteMany({
    where: { truck: { licensePlate: { startsWith: "DEMO-" } } },
  });
  await prisma.truck.deleteMany({
    where: { licensePlate: { startsWith: "DEMO-" } },
  });
  await prisma.user.deleteMany({
    where: { email: { contains: "@demo.hkenv.local" } },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
