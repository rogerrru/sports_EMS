require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const path = require("path");

const { pool, connection } = require("./db");

const app = express();
const port = process.env.PORT || 3000;

// ─── CORS (API routes only) ───────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5500")
  .split(",")
  .map((o) => o.trim());

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("CORS not allowed for origin: " + origin));
  },
  credentials: true,
});

// ─── Sessions (separate cookies for admin vs client) ─────────────────────────
const sessionBase = {
  secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000,
  },
};

const adminSession = session({
  ...sessionBase,
  name: "admin.sid",
  store: new PgSession({ pool, tableName: "session", schemaName: "sports_ems" }),
});

const clientSession = session({
  ...sessionBase,
  name: "client.sid",
  store: new PgSession({ pool, tableName: "session", schemaName: "sports_ems" }),
});

// ─── Static files & view engine ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "assets")));
app.use("/node_modules", express.static(path.join(__dirname, "node_modules")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => res.json({}));

app.use("/api/auth",   clientSession, corsMiddleware, require("./routes/auth"));
app.use("/api/public",               corsMiddleware, require("./routes/public"));
app.use("/api/user",   clientSession, corsMiddleware, require("./routes/user"));
app.use("/",           adminSession,  require("./routes/adminRoutes"));

// ─── Start ────────────────────────────────────────────────────────────────────
connection.connect();
app.listen(port, () => console.log(`Server listening on port ${port}`));
