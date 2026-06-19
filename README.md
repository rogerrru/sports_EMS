# SLU Events Management System

A web-based event management platform for Saint Louis University — Baguio City. It lets students browse events, register with a QR code, and attend sessions, while admins manage events, sessions, organizations, departments, venues, and attendance through a dedicated panel.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend / Admin panel | Node.js + Express, Pug templates |
| Client frontend | Vanilla HTML/CSS/JS (static, no build step) |
| Database | PostgreSQL via Supabase |
| Session store | connect-pg-simple (PostgreSQL-backed) |
| Image storage | Base64 in `event_img TEXT` column |
| QR generation | `qrcode` npm package (server-side) |
| QR scanning | `html5-qrcode` (CDN, admin scanner view) |
| File uploads | Multer (disk storage, base64-converted) |

---

## Project Structure

```
sports_EMS/
├── client/                  # Static frontend (served by Live Server / any static host)
│   ├── index.html           # Landing page
│   ├── events.html          # Public events list
│   ├── event.html           # Event detail + registration
│   ├── myEvents.html        # User's registrations + QR codes
│   ├── login.html
│   ├── signup.html
│   ├── account.html
│   ├── js/
│   │   ├── config.js        # API base URL
│   │   ├── api.js           # fetch wrappers
│   │   └── main.js          # auth, navbar, helpers (window.Page)
│   └── assets/
│       ├── style.css
│       └── media/
│
├── server/                  # Express app (port 3000)
│   ├── admin.js             # Entry point, middleware, route mounting
│   ├── db.js                # PostgreSQL pool, mysqlToPg(), camelizeRows()
│   ├── schema.pg.sql        # PostgreSQL schema (safe to re-run)
│   ├── migrate.js           # Runs schema.pg.sql against the DB
│   ├── seed.js              # Optional seed data
│   ├── middleware/
│   │   └── auth.js          # requireAuth / requireAdmin
│   ├── routes/
│   │   ├── adminRoutes.js   # All admin-panel HTML routes
│   │   ├── public.js        # GET /api/public/* (no auth)
│   │   ├── user.js          # GET|POST|DELETE /api/user/* (client session)
│   │   └── auth.js          # /api/auth/login|logout|me|signup
│   ├── views/               # Pug templates for admin panel
│   ├── assets/
│   │   ├── styles/styles.css
│   │   └── scripts/readEvent.js
│   ├── .env.example
│   └── package.json
│
├── readme_img/              # Screenshots for this README
├── .gitignore
└── package.json             # Root-level dev convenience scripts
```

---

## Local Development Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd sports_EMS
```

### 2. Configure environment variables

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres
SESSION_SECRET=some-long-random-string
CLIENT_ORIGIN=http://localhost:5500
PORT=3000
```

`DATABASE_URL` points to your Supabase project. Find it in the Supabase dashboard under **Settings → Database → Connection string → URI**.

### 3. Run the database migration

```bash
cd server
node migrate.js
```

This creates all tables in the `sports_ems` schema. It is idempotent — safe to run multiple times.

### 4. (Optional) Seed sample data

```bash
node seed.js
```

### 5. Install server dependencies and start

```bash
npm install
npm run dev        # nodemon auto-restarts on file changes
```

The Express server runs on **http://localhost:3000**.

### 6. Serve the client

Open the `client/` folder with **VS Code Live Server** (right-click `index.html` → *Open with Live Server*). It defaults to **http://localhost:5500**.

---

## Access Points

| URL | Description |
|---|---|
| `http://localhost:5500` | Client frontend (Live Server) |
| `http://localhost:3000/admin/login` | Admin panel login |
| `http://localhost:3000/api/public/events` | Public events API |
| `http://localhost:3000/health` | Server health check |

---

## Event Categories & Access Control

| Category | Who can view | Who can register |
|---|---|---|
| Open | Everyone | Any logged-in user |
| University | Everyone | Users with `@slu.edu.ph` email |
| Departmental | Everyone | Users in the host department |
| Organizational | Everyone | Members of the host organization |

Registration is also blocked when an event has no sessions scheduled yet.

---

## Key Features

### Client (Student-facing)
- Browse all events with search and status filter
- Event detail page with sessions, venue, category, and eligibility info
- One-click registration (eligibility enforced server-side)
- QR code generated on registration — shown in **My Events**
- Forfeit (cancel) registration for upcoming/ongoing events

### Admin Panel
- Full CRUD for Events, Sessions, Departments, Organizations, Venues, Users
- Inline date pickers for event schedule (start/end date)
- Create Session auto-fills first day + start time from the previous session
- QR scanner for session attendance check-in
- Clear scan feedback: success with attendee name, or specific error (wrong event, already checked in, invalid QR)
- Attendance list per session

---

## Environment Variables Reference

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `SESSION_SECRET` | Secret for session signing | `dev-secret-change-in-production` |
| `CLIENT_ORIGIN` | Comma-separated allowed CORS origins | `http://localhost:5500` |
| `PORT` | Express listen port | `3000` |
| `NODE_ENV` | Set to `production` for secure cookies | — |

---

## Authors

- Bullong, Dyna Marie  
- Celedio, Chris Isaiah  
- Chegyem, Roger Jr.  
- De Guzman, Alastair Zeph  
- Decena, Alexcious Norlan  
- Javier, Aliyah Jenelle  
- Payad, Simchoni  
