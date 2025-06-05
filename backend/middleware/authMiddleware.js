const jwt = require("jsonwebtoken");

module.exports = (roles = []) => (req, res, next) => {
  // 1) Read token from “Authorization: Bearer <token>”
  let token = null;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query.token) {
    // 2) Or read token from “?token=<token>”
    token = req.query.token;
  }

  // 3) If no token, return 401
  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    // 4) Verify the JWT
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // 5) If roles array is provided, ensure payload.role is in that array
    if (Array.isArray(roles) && roles.length > 0) {
      if (!roles.includes(payload.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports.isAdmin = isAdmin;