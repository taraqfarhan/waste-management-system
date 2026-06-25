/**
 * auth.js — Session-based auth helpers
 */

function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Login required" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Login required" });
  }
  if (req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports = { requireLogin, requireAdmin };
