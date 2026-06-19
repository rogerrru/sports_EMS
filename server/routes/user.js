const { Router } = require("express");
const QRCode = require("qrcode");
const { dbQuery } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.get("/events", requireAuth, async (req, res) => {
  try {
    const results = await dbQuery(
      `SELECT er.eventRegID, er.eventID, er.registrationDate,
         e.eventName, e.description, e.eventStatus,
         s.startDate, v.venueName, v.venueAddress,
         uq.qr_img
       FROM event_reg er
       JOIN events e ON er.eventID = e.eventID
       LEFT JOIN schedules s ON e.scheduleID = s.scheduleID
       LEFT JOIN venues v ON e.venueID = v.venueID
       LEFT JOIN user_qr uq ON uq.registrationID = er.eventRegID AND uq.userID = er.userID
       WHERE er.userID = ?
       ORDER BY er.registrationDate DESC`,
      [req.session.userID]
    );
    res.json(results);
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/registerEvent/:eventId", requireAuth, async (req, res) => {
  const { userID } = req.session;
  const { eventId } = req.params;
  try {
    const existing = await dbQuery(
      "SELECT eventRegID FROM event_reg WHERE userID = ? AND eventID = ?",
      [userID, eventId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Already registered for this event" });
    }

    const [event] = await dbQuery(
      "SELECT eventCategory, depID, orgID FROM events WHERE eventID = ?",
      [eventId]
    );
    if (!event) return res.status(404).json({ error: "Event not found" });

    const sessions = await dbQuery("SELECT sessionID FROM sessions WHERE eventID = ?", [eventId]);
    if (sessions.length === 0) {
      return res.status(400).json({ error: "This event has no sessions scheduled yet. Registration will open once sessions are added." });
    }

    const [user] = await dbQuery(
      "SELECT email, depID, orgID FROM users WHERE userID = ?",
      [userID]
    );

    const cat = (event.eventCategory || "").toLowerCase();
    if (cat === "university") {
      if (!user.email?.endsWith("@slu.edu.ph")) {
        return res.status(403).json({ error: "This event is open to SLU university email holders only (@slu.edu.ph)." });
      }
    } else if (cat === "departmental") {
      if (!user.depID || String(user.depID) !== String(event.depID)) {
        return res.status(403).json({ error: "This event is restricted to members of the host department." });
      }
    } else if (cat === "organizational") {
      if (!user.orgID || String(user.orgID) !== String(event.orgID)) {
        return res.status(403).json({ error: "This event is restricted to members of the host organization." });
      }
    }

    const result = await dbQuery(
      "INSERT INTO event_reg (userID, eventID, registrationDate) VALUES (?, ?, NOW())",
      [userID, eventId]
    );
    const eventRegID = result.insertId;

    // Generate and store QR code encoding eventID + userID (matches scanner expectation)
    const qrContent = JSON.stringify({ eventID: String(eventId), userID: String(userID) });
    const qrDataUrl = await QRCode.toDataURL(qrContent, { width: 256, margin: 2 });
    const qrBase64 = qrDataUrl.split(",")[1];
    await dbQuery(
      "INSERT INTO user_qr (userID, registrationID, eventID, qr_img) VALUES (?, ?, ?, ?)",
      [userID, eventRegID, eventId, qrBase64]
    );

    res.status(201).json({ message: "Registered successfully", eventRegID });
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/events/:eventRegID", requireAuth, async (req, res) => {
  const { userID } = req.session;
  const { eventRegID } = req.params;
  try {
    const rows = await dbQuery(
      `SELECT er.eventRegID, e.eventStatus
       FROM event_reg er
       JOIN events e ON er.eventID = e.eventID
       WHERE er.eventRegID = ? AND er.userID = ?`,
      [eventRegID, userID]
    );
    if (!rows.length) return res.status(404).json({ error: "Registration not found" });
    if (rows[0].eventStatus === "done") {
      return res.status(403).json({ error: "Cannot forfeit a completed event" });
    }
    await dbQuery("DELETE FROM event_reg WHERE eventRegID = ? AND userID = ?", [eventRegID, userID]);
    res.json({ message: "Registration cancelled" });
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/account", requireAuth, async (req, res) => {
  try {
    const results = await dbQuery(
      `SELECT u.userID, u.firstName, u.lastName, u.email, u.userType, d.depName, o.orgName
       FROM users u
       LEFT JOIN departments d ON u.depID = d.depID
       LEFT JOIN organizations o ON u.orgID = o.orgID
       WHERE u.userID = ?`,
      [req.session.userID]
    );
    if (results.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(results[0]);
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/account", requireAuth, async (req, res) => {
  const { firstName, lastName, email } = req.body;
  try {
    await dbQuery(
      "UPDATE users SET firstName = ?, lastName = ?, email = ? WHERE userID = ?",
      [firstName, lastName, email, req.session.userID]
    );
    req.session.name = firstName;
    res.json({ message: "Account updated" });
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
