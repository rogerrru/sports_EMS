const { Router } = require("express");
const { dbQuery } = require("../db");

const router = Router();

router.get("/events", async (req, res) => {
  const { search, status } = req.query;
  let query = `
    SELECT e.*, s.startDate, s.endDate, s.duration, v.venueName, v.venueAddress
    FROM events e
    LEFT JOIN schedules s ON e.scheduleID = s.scheduleID
    LEFT JOIN venues v ON e.venueID = v.venueID
    WHERE 1=1
  `;
  const values = [];

  if (status) { query += " AND e.eventStatus = ?"; values.push(status); }
  if (search) { query += " AND e.eventName ILIKE ?"; values.push(`%${search}%`); }

  query += " ORDER BY e.eventID DESC";

  try {
    const results = await dbQuery(query, values);
    res.json(results);
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/events/:eventId", async (req, res) => {
  try {
    const results = await dbQuery(
      `SELECT e.*, s.startDate, s.endDate, s.duration, v.venueName, v.venueAddress, d.depName, o.orgName
       FROM events e
       LEFT JOIN schedules s ON e.scheduleID = s.scheduleID
       LEFT JOIN venues v ON e.venueID = v.venueID
       LEFT JOIN departments d ON e.depID = d.depID
       LEFT JOIN organizations o ON e.orgID = o.orgID
       WHERE e.eventID = ?`,
      [req.params.eventId]
    );
    if (results.length === 0) return res.status(404).json({ error: "Event not found" });
    const event = results[0];
    event.sessions = await dbQuery("SELECT * FROM sessions WHERE eventID = ?", [req.params.eventId]);
    res.json(event);
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/latestEvents", async (_req, res) => {
  try {
    const results = await dbQuery(
      `SELECT e.*, s.startDate FROM events e
       LEFT JOIN schedules s ON e.scheduleID = s.scheduleID
       WHERE e.eventStatus IN ('upcoming', 'ongoing')
       ORDER BY e.eventID DESC LIMIT 3`
    );
    res.json(results);
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/departments", async (_req, res) => {
  try {
    res.json(await dbQuery("SELECT depID, depName FROM departments"));
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/organizations", async (_req, res) => {
  try {
    res.json(await dbQuery("SELECT orgID, orgName FROM organizations"));
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
