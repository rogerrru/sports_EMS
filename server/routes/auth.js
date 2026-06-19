const { Router } = require("express");
const bcrypt = require("bcrypt");
const { dbQuery } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    const results = await dbQuery("SELECT * FROM users WHERE email = ?", [email.trim()]);
    const user = results[0];
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid email or password" });

    if (user.userType === "admin") {
      return res.status(403).json({ error: "Admin accounts must log in via the admin panel." });
    }

    req.session.userID   = user.userID;
    req.session.user     = user.email;
    req.session.name     = user.firstName;
    req.session.userType = user.userType;
    req.session.userDet  = user;
    res.json({
      userID: user.userID, firstName: user.firstName, lastName: user.lastName,
      email: user.email, userType: user.userType, depID: user.depID, orgID: user.orgID,
    });
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ message: "Logged out" }));
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const results = await dbQuery(
      "SELECT userID, firstName, lastName, email, userType, depID, orgID FROM users WHERE userID = ?",
      [req.session.userID]
    );
    if (results.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(results[0]);
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/signup", async (req, res) => {
  const { firstName, lastName, email, password, depID, orgID } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  try {
    const existing = await dbQuery("SELECT COUNT(*) AS cnt FROM users WHERE email = ?", [email.trim()]);
    if (existing[0].cnt > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const hashed = await bcrypt.hash(password, 10);
    const result = await dbQuery(
      "INSERT INTO users (firstName, lastName, email, password, depID, orgID, userType, registrationDate) VALUES (?, ?, ?, ?, ?, ?, 'user', NOW())",
      [firstName.trim(), lastName.trim(), email.trim(), hashed, depID || null, orgID || null]
    );
    res.status(201).json({ message: "Registration successful", userID: result.insertId });
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
