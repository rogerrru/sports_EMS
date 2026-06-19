function requireAuth(req, res, next) {
  if (!req.session || !req.session.userID) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || req.session.userType !== "admin") {
    return res.redirect("/admin/login");
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
