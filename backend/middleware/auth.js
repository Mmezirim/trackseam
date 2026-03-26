const jwt    = require("jsonwebtoken");
const Tailor = require("../models/Tailor");

module.exports = async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided." });
    }

    const token   = header.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tailor  = await Tailor.findById(decoded.id).select("-password");

    if (!tailor) return res.status(401).json({ error: "Account not found." });

    req.tailor = tailor;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};