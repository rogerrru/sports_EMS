const { Router } = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { dbQuery } = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = Router();

const fileUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, "../assets/images")),
    filename: (req, file, cb) => {
      cb(null, `event_${req.params.eventId}_${Date.now()}${path.extname(file.originalname)}`);
    },
  }),
});

const EVENT_DETAIL_QUERY = `
  SELECT
    e.*,
    d.depName  AS departmentName,
    d.depDesc  AS departmentDesc,
    o.orgName  AS organizationName,
    v.venueName    AS venueName,
    v.venueAddress AS venueAddress,
    s.startDate AS startDate,
    s.endDate   AS endDate,
    sa.sessionIDs,
    sa.sessionDescs,
    sa.firstDays,
    sa.lastDays,
    sa.startTimes,
    sa.endTimes
  FROM events e
  LEFT JOIN departments  d ON e.depID     = d.depID
  LEFT JOIN organizations o ON e.orgID    = o.orgID
  LEFT JOIN venues        v ON e.venueID  = v.venueID
  LEFT JOIN schedules     s ON e.scheduleID = s.scheduleID
  LEFT JOIN (
    SELECT
      eventID,
      STRING_AGG(CAST(sessionID  AS TEXT), ',' ORDER BY sessionID) AS sessionIDs,
      STRING_AGG(CAST(sessionDesc AS TEXT), ',' ORDER BY sessionID) AS sessionDescs,
      STRING_AGG(CAST(firstDay   AS TEXT), ',' ORDER BY sessionID) AS firstDays,
      STRING_AGG(CAST(lastDay    AS TEXT), ',' ORDER BY sessionID) AS lastDays,
      STRING_AGG(CAST(startTime  AS TEXT), ',' ORDER BY sessionID) AS startTimes,
      STRING_AGG(CAST(endTime    AS TEXT), ',' ORDER BY sessionID) AS endTimes
    FROM sessions
    GROUP BY eventID
  ) sa ON sa.eventID = e.eventID
  WHERE e.eventID = ?
`;

const USER_DETAIL_QUERY = `
  SELECT
    u.*,
    att.attendanceIDs,
    att.attendance,
    att.eventNameAttend,
    reg.registrationIDs,
    reg.registration,
    reg.eventNameReg,
    d.depName  AS departmentName,
    d.depDesc  AS departmentDesc,
    o.orgName  AS organizationName
  FROM users u
  LEFT JOIN departments   d ON u.depID = d.depID
  LEFT JOIN organizations o ON u.orgID = o.orgID
  LEFT JOIN (
    SELECT
      ea.userID,
      STRING_AGG(CAST(ea.attendanceID       AS TEXT), ',' ORDER BY ea.attendanceID) AS attendanceIDs,
      STRING_AGG(CAST(ea.attendanceDateTime AS TEXT), ',' ORDER BY ea.attendanceID) AS attendance,
      STRING_AGG(CAST(ev.eventName          AS TEXT), ',' ORDER BY ea.attendanceID) AS eventNameAttend
    FROM event_attendance ea
    LEFT JOIN events ev ON ea.eventID = ev.eventID
    GROUP BY ea.userID
  ) att ON att.userID = u.userID
  LEFT JOIN (
    SELECT
      er.userID,
      STRING_AGG(CAST(er.eventRegID       AS TEXT), ',' ORDER BY er.eventRegID) AS registrationIDs,
      STRING_AGG(CAST(er.registrationDate AS TEXT), ',' ORDER BY er.eventRegID) AS registration,
      STRING_AGG(CAST(ev.eventName        AS TEXT), ',' ORDER BY er.eventRegID) AS eventNameReg
    FROM event_reg er
    LEFT JOIN events ev ON er.eventID = ev.eventID
    GROUP BY er.userID
  ) reg ON reg.userID = u.userID
  WHERE u.userID = ?
`;

function parseEventSessions(event) {
  if (!event) return event;
  event.sessionIDs    = event.sessionIDs    ? event.sessionIDs.split(",")    : [];
  event.sessionDescs  = event.sessionDescs  ? event.sessionDescs.split(",")  : [];
  event.firstDays     = event.firstDays     ? event.firstDays.split(",")     : [];
  event.lastDays      = event.lastDays      ? event.lastDays.split(",")      : [];
  event.startTimes    = event.startTimes    ? event.startTimes.split(",")    : [];
  event.endTimes      = event.endTimes      ? event.endTimes.split(",")      : [];
  return event;
}

function parseUserGroups(user) {
  if (!user) return user;
  user.attendanceIDs  = user.attendanceIDs  ? user.attendanceIDs.split(",")  : [];
  user.attendance     = user.attendance     ? user.attendance.split(",")     : [];
  user.eventNameAttend= user.eventNameAttend? user.eventNameAttend.split(",") : [];
  user.registrationIDs= user.registrationIDs? user.registrationIDs.split(",") : [];
  user.registration   = user.registration   ? user.registration.split(",")   : [];
  user.eventNameReg   = user.eventNameReg   ? user.eventNameReg.split(",")   : [];
  return user;
}

// ─── Root redirect ───────────────────────────────────────────────────────────
router.get("/", (req, res) => {
  if (req.session.userType === "admin") return res.redirect("/events");
  res.redirect("/admin/login");
});

// ─── Admin auth (unprotected) ────────────────────────────────────────────────

router.get("/admin/login", (req, res) => {
  if (req.session.userType === "admin") return res.redirect("/events");
  res.render("adminLogin", { error: null });
});

router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const results = await dbQuery("SELECT * FROM users WHERE email = ?", [email?.trim()]);
    const user = results[0];
    if (!user || user.userType !== "admin") {
      return res.render("adminLogin", { error: "Invalid credentials." });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render("adminLogin", { error: "Invalid credentials." });
    }
    req.session.userID   = user.userID;
    req.session.user     = user.email;
    req.session.name     = user.firstName;
    req.session.userType = user.userType;
    res.redirect("/events");
  } catch {
    res.render("adminLogin", { error: "Server error. Try again." });
  }
});

router.get("/admin/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

// ─── Events ──────────────────────────────────────────────────────────────────

router.get("/events", requireAdmin, async (req, res) => {
  try {
    const events = await dbQuery("SELECT * FROM events");
    res.render("events", { events, currentPage: "events", error: req.query.error || null });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/searchEvent", requireAdmin, async (req, res) => {
  const t = `%${req.query.search}%`;
  try {
    const events = await dbQuery(
      "SELECT * FROM events WHERE eventName LIKE ? OR description LIKE ? OR eventStatus LIKE ? OR eventCategory LIKE ?",
      [t, t, t, t]
    );
    res.render("events", { events, currentPage: "events" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/createEvent", requireAdmin, async (req, res) => {
  try {
    const [departments, organizations, venues] = await Promise.all([
      dbQuery("SELECT * FROM departments"),
      dbQuery("SELECT * FROM organizations"),
      dbQuery("SELECT * FROM venues WHERE status = 'available'"),
    ]);
    res.render("createEvent", { departments, organizations, venues, currentPage: "events" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/createEvent", requireAdmin, fileUpload.single("event_img"), async (req, res) => {
  const { eventName, description, eventCategory, eventStatus, depID, orgID, venueID, startDate, endDate } = req.body;
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  try {
    const base64Image = fs.readFileSync(req.file.path).toString("base64");
    let scheduleID = null;
    if (startDate && endDate) {
      const schedRow = await dbQuery(
        "INSERT INTO schedules (startDate, endDate, duration) VALUES (?, ?, ?)",
        [startDate, endDate, ""]
      );
      scheduleID = schedRow.insertId;
    }
    const rows = await dbQuery(
      "INSERT INTO events (eventName, description, eventCategory, eventStatus, event_img, depID, orgID, venueID, scheduleID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [eventName, description, eventCategory, eventStatus, base64Image, depID || null, orgID || null, venueID || null, scheduleID]
    );
    res.redirect(`/readEvent/${rows.insertId}`);
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/readEvent/:eventId", requireAdmin, async (req, res) => {
  try {
    const results = await dbQuery(EVENT_DETAIL_QUERY, [req.params.eventId]);
    res.render("readEvent", { event: parseEventSessions(results[0]), currentPage: "events" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/updateEvent/:eventId", requireAdmin, async (req, res) => {
  try {
    const [departments, organizations, venues, results] = await Promise.all([
      dbQuery("SELECT * FROM departments"),
      dbQuery("SELECT * FROM organizations"),
      dbQuery("SELECT * FROM venues"),
      dbQuery(EVENT_DETAIL_QUERY, [req.params.eventId]),
    ]);
    res.render("updateEvent", { event: parseEventSessions(results[0]), departments, organizations, venues, currentPage: "events" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/updateEvent/:eventId", requireAdmin, fileUpload.single("event_img"), async (req, res) => {
  const { eventId } = req.params;
  const { eventName, description, eventStatus, eventCategory, depID, orgID, venueID, startDate, endDate, scheduleID } = req.body;
  try {
    // Update or create schedule
    let finalScheduleID = scheduleID || null;
    if (startDate && endDate) {
      if (finalScheduleID) {
        await dbQuery("UPDATE schedules SET startDate = ?, endDate = ? WHERE scheduleID = ?", [startDate, endDate, finalScheduleID]);
      } else {
        const schedRow = await dbQuery("INSERT INTO schedules (startDate, endDate, duration) VALUES (?, ?, ?)", [startDate, endDate, ""]);
        finalScheduleID = schedRow.insertId;
      }
    }

    let sql, values;
    if (req.file) {
      const base64Image = fs.readFileSync(req.file.path).toString("base64");
      sql = "UPDATE events SET eventName = ?, description = ?, eventStatus = ?, eventCategory = ?, event_img = ?, depID = ?, orgID = ?, venueID = ?, scheduleID = ? WHERE eventID = ?";
      values = [eventName, description, eventStatus, eventCategory, base64Image, depID || null, orgID || null, venueID || null, finalScheduleID, eventId];
    } else {
      sql = "UPDATE events SET eventName = ?, description = ?, eventStatus = ?, eventCategory = ?, depID = ?, orgID = ?, venueID = ?, scheduleID = ? WHERE eventID = ?";
      values = [eventName, description, eventStatus, eventCategory, depID || null, orgID || null, venueID || null, finalScheduleID, eventId];
    }
    await dbQuery(sql, values);
    const results = await dbQuery(EVENT_DETAIL_QUERY, [eventId]);
    res.render("readEvent", { event: parseEventSessions(results[0]), currentPage: "events" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/deleteEvent/:eventId", requireAdmin, async (req, res) => {
  try {
    const rows = await dbQuery("SELECT scheduleID FROM events WHERE eventID = ?", [req.params.eventId]);
    await dbQuery("DELETE FROM events WHERE eventID = ?", [req.params.eventId]);
    if (rows[0]?.scheduleID) {
      await dbQuery("DELETE FROM schedules WHERE scheduleID = ?", [rows[0].scheduleID]);
    }
    res.redirect("/events");
  } catch (err) {
    console.error("deleteEvent error:", err.message);
    res.redirect("/events?error=" + encodeURIComponent("Could not delete event: " + err.message));
  }
});

// ─── Sessions ────────────────────────────────────────────────────────────────

router.get("/events/:eventId/sessions/:sessionId/participants", requireAdmin, async (req, res) => {
  try {
    const participants = await dbQuery(
      `SELECT event_attendance.*, users.firstName, users.lastName
       FROM event_attendance
       INNER JOIN users ON event_attendance.userID = users.userID
       WHERE event_attendance.sessionID = ?
       ORDER BY users.lastName`,
      [req.params.sessionId]
    );
    res.render("sessionParticipants", { participants, currentPage: "events" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/createSession/:eventId", requireAdmin, async (req, res) => {
  const { eventId } = req.params;
  try {
    const sessions = await dbQuery(
      "SELECT * FROM sessions WHERE eventID = ? ORDER BY sessionID DESC LIMIT 1",
      [eventId]
    );
    const lastSession = sessions[0] || null;
    res.render("createSession", { event: { eventID: eventId }, lastSession, currentPage: "events" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/createSession/:eventId", requireAdmin, async (req, res) => {
  const { eventId } = req.params;
  const { sessionDesc, firstDay, lastDay, startTime, endTime } = req.body;
  try {
    await dbQuery(
      "INSERT INTO sessions (eventID, sessionDesc, firstDay, lastDay, startTime, endTime) VALUES (?, ?, ?, ?, ?, ?)",
      [eventId, sessionDesc, firstDay, lastDay, startTime, endTime]
    );
    const results = await dbQuery(EVENT_DETAIL_QUERY, [eventId]);
    res.render("readEvent", { event: parseEventSessions(results[0]), currentPage: "events" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/updateSession/:eventId/:sessionId", requireAdmin, async (req, res) => {
  const { eventId, sessionId } = req.params;
  try {
    const sessionRows = await dbQuery(
      "SELECT * FROM sessions WHERE eventID = ? AND sessionID = ?",
      [eventId, sessionId]
    );
    res.render("updateSession", { event: { eventID: eventId }, session: sessionRows[0], currentPage: "events" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/updateSession/:eventId/:sessionId", requireAdmin, async (req, res) => {
  const { eventId, sessionId } = req.params;
  const { sessionDesc, firstDay, lastDay, startTime, endTime } = req.body;
  try {
    await dbQuery(
      "UPDATE sessions SET sessionDesc = ?, firstDay = ?, lastDay = ?, startTime = ?, endTime = ? WHERE eventID = ? AND sessionID = ?",
      [sessionDesc, firstDay, lastDay, startTime, endTime, eventId, sessionId]
    );
    res.redirect(`/updateEvent/${eventId}`);
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/deleteSession/:eventId/:sessionId", requireAdmin, async (req, res) => {
  try {
    await dbQuery("DELETE FROM sessions WHERE sessionID = ?", [req.params.sessionId]);
    res.redirect(`/updateEvent/${req.params.eventId}`);
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Departments ──────────────────────────────────────────────────────────────

router.get("/departments", requireAdmin, async (req, res) => {
  try {
    const departments = await dbQuery("SELECT * FROM departments");
    res.render("departments", { departments, currentPage: "departments" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/searchDepartment", requireAdmin, async (req, res) => {
  const t = `%${req.query.search}%`;
  try {
    const departments = await dbQuery("SELECT * FROM departments WHERE depName LIKE ? OR depDesc LIKE ?", [t, t]);
    res.render("departments", { departments, currentPage: "departments" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/createDepartment", requireAdmin, (_req, res) => res.render("createDepartment", { currentPage: "departments" }));

router.post("/createDepartment", requireAdmin, async (req, res) => {
  try {
    await dbQuery("INSERT INTO departments (depName, depDesc) VALUES (?, ?)", [req.body.depName, req.body.depDesc]);
    res.redirect("/departments");
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/updateDepartment/:depId", requireAdmin, async (req, res) => {
  try {
    const rows = await dbQuery("SELECT * FROM departments WHERE depID = ?", [req.params.depId]);
    res.render("updateDepartment", { department: rows[0], currentPage: "departments" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/updateDepartment/:depId", requireAdmin, async (req, res) => {
  try {
    await dbQuery("UPDATE departments SET depName = ?, depDesc = ? WHERE depID = ?", [req.body.depName, req.body.depDesc, req.params.depId]);
    res.redirect("/departments");
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/deleteDepartment/:depId", requireAdmin, async (req, res) => {
  try {
    await dbQuery("DELETE FROM departments WHERE depID = ?", [req.params.depId]);
    res.redirect("/departments");
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Organizations ────────────────────────────────────────────────────────────

router.get("/organizations", requireAdmin, async (req, res) => {
  try {
    const organizations = await dbQuery("SELECT * FROM organizations");
    res.render("organizations", { organizations, currentPage: "organizations" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/searchOrganization", requireAdmin, async (req, res) => {
  try {
    const organizations = await dbQuery("SELECT * FROM organizations WHERE orgName LIKE ?", [`%${req.query.search}%`]);
    res.render("organizations", { organizations, currentPage: "organizations" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/createOrganization", requireAdmin, (_req, res) => res.render("createOrganization", { currentPage: "organizations" }));

router.post("/createOrganization", requireAdmin, async (req, res) => {
  try {
    await dbQuery("INSERT INTO organizations (orgName, SLUorg) VALUES (?, ?)", [req.body.orgName, req.body.SLUorg]);
    res.redirect("/organizations");
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/updateOrganization/:orgId", requireAdmin, async (req, res) => {
  try {
    const rows = await dbQuery("SELECT * FROM organizations WHERE orgID = ?", [req.params.orgId]);
    res.render("updateOrganization", { organization: rows[0], currentPage: "organizations" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/updateOrganization/:orgId", requireAdmin, async (req, res) => {
  try {
    await dbQuery("UPDATE organizations SET orgName = ?, SLUorg = ? WHERE orgID = ?", [req.body.orgName, req.body.SLUorg, req.params.orgId]);
    res.redirect("/organizations");
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/deleteOrganization/:orgId", requireAdmin, async (req, res) => {
  try {
    await dbQuery("DELETE FROM organizations WHERE orgID = ?", [req.params.orgId]);
    res.redirect("/organizations");
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Users ────────────────────────────────────────────────────────────────────

router.get("/users", requireAdmin, async (req, res) => {
  try {
    const users = await dbQuery("SELECT * FROM users");
    res.render("users", { users, currentPage: "users" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/searchUser", requireAdmin, async (req, res) => {
  const t = `%${req.query.search}%`;
  try {
    const users = await dbQuery("SELECT * FROM users WHERE firstname LIKE ? OR lastname LIKE ? OR email LIKE ?", [t, t, t]);
    res.render("users", { users, currentPage: "users" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/createUser", requireAdmin, (_req, res) => res.render("createUser", { currentPage: "users" }));

router.post("/createUser", requireAdmin, async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await dbQuery("INSERT INTO users (firstName, lastName, email, password) VALUES (?, ?, ?, ?)", [firstName, lastName, email, hashed]);
    res.redirect("/users");
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/readUser/:userId", requireAdmin, async (req, res) => {
  try {
    const results = await dbQuery(USER_DETAIL_QUERY, [req.params.userId]);
    res.render("readUser", { user: parseUserGroups(results[0]), currentPage: "users" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/updateUser/:userId", requireAdmin, async (req, res) => {
  try {
    const [departments, organizations, results] = await Promise.all([
      dbQuery("SELECT * FROM departments"),
      dbQuery("SELECT * FROM organizations"),
      dbQuery(USER_DETAIL_QUERY, [req.params.userId]),
    ]);
    res.render("updateUser", { user: parseUserGroups(results[0]), departments, organizations, currentPage: "users" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/updateUser/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { firstName, lastName, password, email, userType, depID, orgID } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await dbQuery(
      "UPDATE users SET firstName = ?, lastName = ?, password = ?, email = ?, userType = ?, depID = IFNULL(?, depID), orgID = IFNULL(?, orgID) WHERE userID = ?",
      [firstName, lastName, hashed, email, userType, depID || null, orgID || null, userId]
    );
    const results = await dbQuery(USER_DETAIL_QUERY, [userId]);
    res.render("readUser", { user: parseUserGroups(results[0]), currentPage: "users" });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/deleteUser/:userId", requireAdmin, async (req, res) => {
  try {
    await dbQuery("DELETE FROM users WHERE userID = ?", [req.params.userId]);
    res.redirect("/users");
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Schedules & Venues ───────────────────────────────────────────────────────

router.get("/createSchedule", requireAdmin, (_req, res) => res.render("createSchedule", { currentPage: "events" }));

router.post("/createSchedule", requireAdmin, async (req, res) => {
  try {
    await dbQuery("INSERT INTO schedules(duration, startDate, endDate) VALUES (?,?,?)", [req.body.duration, req.body.startDate, req.body.endDate]);
    res.redirect("/events");
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.get("/createVenue", requireAdmin, (_req, res) => res.render("createVenue", { currentPage: "events" }));

router.post("/createVenue", requireAdmin, async (req, res) => {
  try {
    await dbQuery("INSERT INTO venues(venueName, venueAddress, status) VALUES (?,?,'available')", [req.body.venueName, req.body.venueAddress]);
    res.redirect("/events");
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── QR / Attendance ─────────────────────────────────────────────────────────

router.get("/scanner/:eventID/:sessionID", requireAdmin, async (req, res) => {
  const { eventID, sessionID } = req.params;
  try {
    const [sessionRows, attendance] = await Promise.all([
      dbQuery(
        `SELECT sessions.*, events.eventName, events.description AS eventDescription,
           events.eventStatus, events.eventCategory,
           departments.depName AS departmentName, organizations.orgName AS organizationName
         FROM sessions
           LEFT JOIN events ON sessions.eventID = events.eventID
           LEFT JOIN departments ON events.depID = departments.depID
           LEFT JOIN organizations ON events.orgID = organizations.orgID
         WHERE sessions.eventID = ? AND sessions.sessionID = ?`,
        [eventID, sessionID]
      ),
      dbQuery(
        `SELECT event_attendance.attendanceID, event_attendance.attendanceDateTime,
           users.firstName, users.lastName
         FROM event_attendance
           LEFT JOIN events ON event_attendance.eventID = events.eventID
           LEFT JOIN users ON event_attendance.userID = users.userID
           LEFT JOIN sessions ON event_attendance.sessionID = sessions.sessionID
         WHERE events.eventID = ? AND sessions.sessionID = ?`,
        [eventID, sessionID]
      ),
    ]);
    res.render("scanner", {
      session: sessionRows[0],
      eventAttendance: attendance,
      currentPage: "events",
      error: req.query.error || null,
      success: req.query.success || null,
    });
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

router.post("/processQRCode/:eventId/:sessionId", requireAdmin, async (req, res) => {
  const { eventId, sessionId } = req.params;
  const scannerUrl = `/scanner/${eventId}/${sessionId}`;

  let qrCodeObject;
  try {
    qrCodeObject = JSON.parse(req.body.qrCodeData);
  } catch {
    return res.redirect(`${scannerUrl}?error=${encodeURIComponent("Invalid QR code — could not read the data.")}`);
  }

  if (String(qrCodeObject.eventID) !== String(eventId)) {
    return res.redirect(`${scannerUrl}?error=${encodeURIComponent("Wrong event — this QR code belongs to a different event. Please scan the correct attendee QR.")}`);
  }

  try {
    // Prevent duplicate attendance for the same session
    const existing = await dbQuery(
      "SELECT attendanceID FROM event_attendance WHERE userID = ? AND sessionID = ?",
      [qrCodeObject.userID, sessionId]
    );
    if (existing.length > 0) {
      return res.redirect(`${scannerUrl}?error=${encodeURIComponent("Already checked in — this attendee has already been scanned for this session.")}`);
    }

    await dbQuery(
      "INSERT INTO event_attendance (eventID, userID, sessionID, attendanceDateTime) VALUES (?, ?, ?, NOW())",
      [qrCodeObject.eventID, qrCodeObject.userID, sessionId]
    );

    const users = await dbQuery(
      "SELECT firstName, lastName FROM users WHERE userID = ?",
      [qrCodeObject.userID]
    );
    const name = users[0] ? `${users[0].firstName} ${users[0].lastName}` : "Attendee";
    res.redirect(`${scannerUrl}?success=${encodeURIComponent(`${name} checked in successfully!`)}`);
  } catch {
    res.redirect(`${scannerUrl}?error=${encodeURIComponent("Server error — attendance could not be recorded. Please try again.")}`);
  }
});

module.exports = router;
