/**
 * Seed script — populates sports_ems schema with sample data.
 * Run: node server/seed.js
 *
 * Safe to re-run: uses INSERT … ON CONFLICT DO NOTHING where possible.
 */
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const isRemote =
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes("localhost") &&
  !process.env.DATABASE_URL.includes("127.0.0.1");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
  options: "--search_path=sports_ems",
});

async function q(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function seed() {
  console.log("🌱  Seeding sports_ems schema…\n");

  // ── Departments ──────────────────────────────────────────────────────────────
  console.log("  departments…");
  await q(`
    INSERT INTO departments (depName, depDesc) VALUES
      ('College of Engineering and Architecture', 'CEA — engineering and architectural programs'),
      ('College of Information and Computing Sciences', 'CICS — computing and information technology programs'),
      ('College of Business and Accountancy', 'CBA — business administration and accountancy programs'),
      ('College of Nursing', 'CON — nursing and health sciences programs'),
      ('College of Education', 'COEd — education and teacher training programs'),
      ('College of Arts and Sciences', 'CAS — liberal arts and sciences programs'),
      ('College of Law', 'COL — law and jurisprudence programs'),
      ('Senior High School', 'SHS — grade 11 and 12 programs')
    ON CONFLICT DO NOTHING
  `);

  // ── Organizations ────────────────────────────────────────────────────────────
  console.log("  organizations…");
  await q(`
    INSERT INTO organizations (orgName, SLUorg) VALUES
      ('Supreme Student Council', 1),
      ('Junior Philippine Institute of Accountants', 1),
      ('Society of Civil Engineering Students', 1),
      ('Computer Science Society', 1),
      ('Nursing Students Association', 1),
      ('SLU Dance Troupe', 1),
      ('SLU Chorale', 1),
      ('SLU Mountaineers', 1),
      ('Psychology Society', 1),
      ('Debate Society', 1)
    ON CONFLICT DO NOTHING
  `);

  // ── Venues ───────────────────────────────────────────────────────────────────
  console.log("  venues…");
  await q(`
    INSERT INTO venues (venueName, venueAddress, status) VALUES
      ('SLU Gymnasium', 'A.  Bonifacio St., Baguio City', 'available'),
      ('SLU Auditorium', 'A. Bonifacio St., Baguio City', 'available'),
      ('Leonardus Hall', 'SLU Campus, Baguio City', 'available'),
      ('Engineering Building Conference Room', 'CEA Building, SLU Campus', 'available'),
      ('CICS Computer Laboratory 1', 'CICS Building, SLU Campus', 'available'),
      ('SLU Open Grounds', 'SLU Campus, Baguio City', 'available'),
      ('Fr. Bunfortunato Hall', 'SLU Campus, Baguio City', 'available'),
      ('Online / Zoom', 'Virtual', 'available')
    ON CONFLICT DO NOTHING
  `);

  // ── Schedules ────────────────────────────────────────────────────────────────
  console.log("  schedules…");
  const { rows: sched } = await q(`
    INSERT INTO schedules (startDate, endDate, duration) VALUES
      ('2026-07-01', '2026-07-01', '1 day'),
      ('2026-07-10', '2026-07-12', '3 days'),
      ('2026-07-20', '2026-07-20', '1 day'),
      ('2026-08-05', '2026-08-07', '3 days'),
      ('2026-08-15', '2026-08-15', '1 day'),
      ('2026-08-25', '2026-08-26', '2 days'),
      ('2026-09-10', '2026-09-10', '1 day'),
      ('2026-09-20', '2026-09-21', '2 days')
    RETURNING scheduleID
  `);
  const schedIDs = sched.map((r) => r.scheduleid);

  // ── Venues & Departments — fetch IDs ─────────────────────────────────────────
  const { rows: deps }   = await q("SELECT depID, depName FROM departments ORDER BY depID");
  const { rows: orgs }   = await q("SELECT orgID, orgName FROM organizations ORDER BY orgID");
  const { rows: venues } = await q("SELECT venueID, venueName FROM venues ORDER BY venueID");

  const depMap  = Object.fromEntries(deps.map((d) => [d.depname, d.depid]));
  const orgMap  = Object.fromEntries(orgs.map((o) => [o.orgname, o.orgid]));
  const venueIDs = venues.map((v) => v.venueid);

  // ── Events ───────────────────────────────────────────────────────────────────
  console.log("  events…");
  const eventRows = [
    {
      name: "SLU Engineering Summit 2026",
      category: "open",
      status: "upcoming",
      desc: "A gathering of engineering students and professionals to discuss innovations in infrastructure and sustainable design.",
      dep: "College of Engineering and Architecture",
      org: null,
      venueIdx: 0,
      schedIdx: 0,
    },
    {
      name: "Hackathon: Code for Baguio",
      category: "open",
      status: "upcoming",
      desc: "A 3-day hackathon challenging students to build technology solutions for Baguio City's urban challenges.",
      dep: "College of Information and Computing Sciences",
      org: "Computer Science Society",
      venueIdx: 4,
      schedIdx: 1,
    },
    {
      name: "SLU Career Fair 2026",
      category: "open",
      status: "upcoming",
      desc: "Connect with top employers from various industries. Bring your resume and explore internship and job opportunities.",
      dep: null,
      org: "Supreme Student Council",
      venueIdx: 0,
      schedIdx: 2,
    },
    {
      name: "Nursing Simulation Training",
      category: "department",
      status: "upcoming",
      desc: "Advanced clinical simulation exercises for nursing students covering emergency response and patient care protocols.",
      dep: "College of Nursing",
      org: "Nursing Students Association",
      venueIdx: 2,
      schedIdx: 3,
    },
    {
      name: "SLU Cultural Night",
      category: "open",
      status: "ongoing",
      desc: "An evening of music, dance, and art celebrating the diverse cultures represented in the SLU community.",
      dep: null,
      org: "SLU Dance Troupe",
      venueIdx: 1,
      schedIdx: 4,
    },
    {
      name: "Accountancy Review Week",
      category: "department",
      status: "upcoming",
      desc: "Intensive review sessions for CPA board exam candidates covering all major subject areas.",
      dep: "College of Business and Accountancy",
      org: "Junior Philippine Institute of Accountants",
      venueIdx: 2,
      schedIdx: 5,
    },
    {
      name: "SLU Intramurals 2026",
      category: "open",
      status: "upcoming",
      desc: "The annual inter-department sports competition featuring basketball, volleyball, badminton, and chess.",
      dep: null,
      org: "Supreme Student Council",
      venueIdx: 0,
      schedIdx: 6,
    },
    {
      name: "Debate Championship: Policy Round",
      category: "open",
      status: "done",
      desc: "Inter-collegiate debate competition on national policy issues. Open to all SLU students.",
      dep: "College of Arts and Sciences",
      org: "Debate Society",
      venueIdx: 6,
      schedIdx: 7,
    },
  ];

  const { rows: insertedEvents } = await q(`
    INSERT INTO events
      (eventName, eventCategory, eventStatus, description, depID, orgID, venueID, scheduleID)
    VALUES
      ${eventRows.map((_, i) =>
        `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`
      ).join(",\n      ")}
    RETURNING eventID
  `, eventRows.flatMap((e) => [
    e.name,
    e.category,
    e.status,
    e.desc,
    e.dep ? depMap[e.dep] : null,
    e.org ? orgMap[e.org] : null,
    venueIDs[e.venueIdx],
    schedIDs[e.schedIdx],
  ]));

  const eventIDs = insertedEvents.map((r) => r.eventid);

  // ── Sessions (for first 3 events) ───────────────────────────────────────────
  console.log("  sessions…");
  await q(`
    INSERT INTO sessions (eventID, scheduleID, sessionDesc, firstDay, lastDay, startTime, endTime) VALUES
      ($1, $2, 'Opening Keynote',             '2026-07-01', '2026-07-01', '08:00', '10:00'),
      ($1, $2, 'Technical Paper Presentations','2026-07-01', '2026-07-01', '10:30', '12:00'),
      ($3, $4, 'Day 1 — Ideation & Planning',  '2026-07-10', '2026-07-10', '09:00', '18:00'),
      ($3, $4, 'Day 2 — Development Sprint',   '2026-07-11', '2026-07-11', '08:00', '20:00'),
      ($3, $4, 'Day 3 — Demo & Judging',       '2026-07-12', '2026-07-12', '09:00', '17:00'),
      ($5, $6, 'Morning Industry Panels',      '2026-07-20', '2026-07-20', '08:00', '12:00'),
      ($5, $6, 'Afternoon Networking',         '2026-07-20', '2026-07-20', '13:00', '17:00')
  `, [
    eventIDs[0], schedIDs[0],
    eventIDs[1], schedIDs[1],
    eventIDs[2], schedIDs[2],
  ]);

  // ── Users ────────────────────────────────────────────────────────────────────
  console.log("  users (hashing passwords)…");
  const [adminHash, user1Hash, user2Hash, user3Hash] = await Promise.all([
    bcrypt.hash("Admin@123", 10),
    bcrypt.hash("Student@123", 10),
    bcrypt.hash("Student@123", 10),
    bcrypt.hash("Student@123", 10),
  ]);

  const usersToInsert = [
    { firstName: "Admin", lastName: "SLU",    email: "admin@slu.edu.ph", hash: adminHash, type: "admin", depID: null,          orgID: null          },
    { firstName: "Juan",  lastName: "Santos", email: "juan@slu.edu.ph",  hash: user1Hash, type: "user",  depID: deps[1].depid, orgID: orgs[3].orgid },
    { firstName: "Maria", lastName: "Reyes",  email: "maria@slu.edu.ph", hash: user2Hash, type: "user",  depID: deps[3].depid, orgID: orgs[4].orgid },
    { firstName: "Pedro", lastName: "Cruz",   email: "pedro@slu.edu.ph", hash: user3Hash, type: "user",  depID: deps[2].depid, orgID: null          },
  ];

  const insertedUsers = [];
  for (const u of usersToInsert) {
    const { rows } = await q(
      `INSERT INTO users (firstName, lastName, email, password, userType, depID, orgID)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING
       RETURNING userID`,
      [u.firstName, u.lastName, u.email, u.hash, u.type, u.depID, u.orgID]
    );
    if (rows.length) insertedUsers.push(rows[0]);
  }

  // ── Event Registrations (only if users were inserted) ───────────────────────
  if (insertedUsers.length > 0) {
    console.log("  event registrations…");
    const userIDs = insertedUsers.map((r) => r.userid);
    // register regular users for the first few events
    const regs = [
      [userIDs[1], eventIDs[0]],
      [userIDs[1], eventIDs[1]],
      [userIDs[2], eventIDs[2]],
      [userIDs[2], eventIDs[3]],
      [userIDs[3], eventIDs[0]],
      [userIDs[3], eventIDs[2]],
    ].filter(([uid]) => uid !== undefined);

    for (const [uid, eid] of regs) {
      await q(
        "INSERT INTO event_reg (userID, eventID) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [uid, eid]
      );
    }
  }

  console.log("\n✅  Seed complete!\n");
  console.log("  Admin login:   admin@slu.edu.ph  /  Admin@123");
  console.log("  Student login: juan@slu.edu.ph   /  Student@123\n");
}

seed()
  .catch((err) => { console.error("❌  Seed failed:", err.message); process.exit(1); })
  .finally(() => pool.end());
