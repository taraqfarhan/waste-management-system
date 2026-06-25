/**
 * index.js — RCC Waste Management System v2
 * Express server with SQLite, session auth, and all API routes
 */

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const { getDb, query, run } = require("./db");
const { requireLogin, requireAdmin } = require("./auth");
const { generateMonthlyReport } = require("./pdf");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));
app.use(
  session({
    secret: "rcc-wms-secret-2024",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 3600 * 1000 }, // 7 days
  }),
);

// ── Init DB then start ───────────────────────────────────
getDb()
  .then(() => {
    console.log("✓ Database ready");

    // ── Record fill levels every 10 minutes ─────────────────
    const stationsRaw = fs.readFileSync(
      path.join(__dirname, "../public/data/stations.json"),
      "utf8",
    );
    const { stations } = JSON.parse(stationsRaw);

    function recordFillLevels() {
      const now = new Date();
      stations.forEach((st) => {
        // Simulate fill level based on time since clearance
        const [time, period] = st.clearance_time
          .trim()
          .toLowerCase()
          .split(" ");
        let [h, m] = time.split(":").map(Number);
        if (period === "pm" && h !== 12) h += 12;
        if (period === "am" && h === 12) h = 0;
        let clr = new Date();
        clr.setHours(h, m || 0, 0, 0);
        if (clr < now) clr.setDate(clr.getDate() + 1);
        const diff = clr - now;
        const total = 24 * 3600000;
        const fill = Math.min(
          100,
          Math.max(0, Math.round(((total - diff) / total) * 100)),
        );
        run("INSERT INTO fill_history (station_id, fill_pct) VALUES (?, ?)", [
          st.id,
          fill,
        ]);
      });
    }

    recordFillLevels();
    setInterval(recordFillLevels, 10 * 60 * 1000);

    app.listen(PORT, () => {
      console.log(`✓ Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB init failed:", err);
    process.exit(1);
  });

// ════════════════════════════════════════════════════════
//  AUTH ROUTES
// ════════════════════════════════════════════════════════

// Register
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "All fields required" });
  if (password.length < 6)
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });

  const existing = query("SELECT id FROM users WHERE email=?", [email]);
  if (existing.length > 0)
    return res.status(409).json({ error: "Email already registered" });

  const hash = bcrypt.hashSync(password, 10);
  const id = run(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'citizen')",
    [name, email.toLowerCase(), hash],
  );
  req.session.user = { id, name, email: email.toLowerCase(), role: "citizen" };
  res.json({ user: req.session.user });
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  const rows = query("SELECT * FROM users WHERE email=?", [
    email.toLowerCase(),
  ]);
  if (rows.length === 0)
    return res.status(401).json({ error: "Invalid email or password" });

  const user = rows[0];
  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: "Invalid email or password" });

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  res.json({ user: req.session.user });
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// Current session
app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

// ════════════════════════════════════════════════════════
//  COMPLAINTS ROUTES
// ════════════════════════════════════════════════════════

// Submit complaint (public — citizens can submit without login, but login pre-fills)
app.post("/api/complaints", (req, res) => {
  const { station_id, station_name, user_name, user_phone, type, description } =
    req.body;
  if (!station_id || !station_name || !user_name || !type || !description)
    return res.status(400).json({ error: "Missing required fields" });

  const userId = req.session.user ? req.session.user.id : null;
  const id = run(
    `INSERT INTO complaints
     (station_id, station_name, user_id, user_name, user_phone, type, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      station_id,
      station_name,
      userId,
      user_name,
      user_phone || "",
      type,
      description,
    ],
  );
  res.json({ id, message: "Complaint submitted successfully" });
});

// My complaints (citizen)
app.get("/api/complaints/mine", requireLogin, (req, res) => {
  const rows = query(
    "SELECT * FROM complaints WHERE user_id=? ORDER BY created_at DESC",
    [req.session.user.id],
  );
  res.json(rows);
});

// All complaints (admin)
app.get("/api/complaints", requireAdmin, (req, res) => {
  const { station, status, month, year } = req.query;
  let sql = "SELECT * FROM complaints WHERE 1=1";
  const params = [];
  if (station) {
    sql += " AND station_id=?";
    params.push(station);
  }
  if (status) {
    sql += " AND status=?";
    params.push(status);
  }
  if (month && year) {
    sql += " AND strftime('%m', created_at)=? AND strftime('%Y', created_at)=?";
    params.push(String(month).padStart(2, "0"), String(year));
  }
  sql += " ORDER BY created_at DESC";
  res.json(query(sql, params));
});

// Update complaint status (admin)
app.patch("/api/complaints/:id", requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!["pending", "reviewing", "resolved"].includes(status))
    return res.status(400).json({ error: "Invalid status" });
  const resolved_at = status === "resolved" ? new Date().toISOString() : null;
  run("UPDATE complaints SET status=?, resolved_at=? WHERE id=?", [
    status,
    resolved_at,
    req.params.id,
  ]);
  res.json({ ok: true });
});

// Complaint analytics
app.get("/api/complaints/analytics", requireAdmin, (req, res) => {
  const byStation = query(`
    SELECT station_name, station_id,
           COUNT(*) as total,
           SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END) as resolved
    FROM complaints
    GROUP BY station_id
    ORDER BY total DESC
  `);

  const byType = query(`
    SELECT type, COUNT(*) as count
    FROM complaints
    GROUP BY type
    ORDER BY count DESC
  `);

  const byMonth = query(`
    SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
    FROM complaints
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `);

  const byStatus = query(`
    SELECT status, COUNT(*) as count
    FROM complaints
    GROUP BY status
  `);

  res.json({ byStation, byType, byMonth, byStatus });
});

// ════════════════════════════════════════════════════════
//  FILL HISTORY / STATION HISTORY
// ════════════════════════════════════════════════════════

app.get("/api/fill-history/:stationId", (req, res) => {
  const { days = 7 } = req.query;
  const rows = query(
    `
    SELECT station_id,
           strftime('%Y-%m-%d %H:00', recorded_at) as hour,
           ROUND(AVG(fill_pct)) as avg_fill
    FROM fill_history
    WHERE station_id=?
      AND recorded_at >= datetime('now', '-${parseInt(days)} days')
    GROUP BY hour
    ORDER BY hour ASC
  `,
    [req.params.stationId],
  );
  res.json(rows);
});

app.get("/api/fill-history", (req, res) => {
  const { days = 7 } = req.query;
  const rows = query(`
    SELECT station_id,
           strftime('%Y-%m-%d', recorded_at) as day,
           ROUND(AVG(fill_pct)) as avg_fill
    FROM fill_history
    WHERE recorded_at >= datetime('now', '-${parseInt(days)} days')
    GROUP BY station_id, day
    ORDER BY day ASC, station_id ASC
  `);
  res.json(rows);
});

// ════════════════════════════════════════════════════════
//  ADMIN — USERS
// ════════════════════════════════════════════════════════

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const rows = query(
    "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC",
  );
  res.json(rows);
});

app.patch("/api/admin/users/:id/role", requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!["citizen", "admin"].includes(role))
    return res.status(400).json({ error: "Invalid role" });
  run("UPDATE users SET role=? WHERE id=?", [role, req.params.id]);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════
//  PDF REPORT
// ════════════════════════════════════════════════════════

app.get("/api/report/monthly", requireAdmin, (req, res) => {
  const now = new Date();
  const month = parseInt(req.query.month || now.getMonth() + 1);
  const year = parseInt(req.query.year || now.getFullYear());

  const stationsRaw = fs.readFileSync(
    path.join(__dirname, "../public/data/stations.json"),
    "utf8",
  );
  const { stations } = JSON.parse(stationsRaw);

  const monthStr = String(month).padStart(2, "0");
  const complaints = query(
    `SELECT * FROM complaints
     WHERE strftime('%m', created_at)=? AND strftime('%Y', created_at)=?
     ORDER BY created_at DESC`,
    [monthStr, String(year)],
  );

  const fillStats = query(
    `
    SELECT station_id, ROUND(AVG(fill_pct)) as avg_fill
    FROM fill_history
    WHERE strftime('%m', recorded_at)=? AND strftime('%Y', recorded_at)=?
    GROUP BY station_id
  `,
    [monthStr, String(year)],
  );

  generateMonthlyReport(res, { month, year, stations, complaints, fillStats });
});

// ── SPA fallback — serve index.html for all non-API routes ──
app.get("*", (req, res) => {
  if (req.path.startsWith("/api"))
    return res.status(404).json({ error: "Not found" });
  res.sendFile(path.join(__dirname, "../public/index.html"));
});
