const jwt    = require("jsonwebtoken");
const prisma = require("../lib/prisma");

module.exports = async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided." });
    }

    const token   = header.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tailor  = await prisma.tailor.findUnique({ where: { id: decoded.id } });

    if (!tailor) return res.status(401).json({ error: "Account not found." });

    // Tokens issued before the last password change are no longer valid.
    if (tailor.passwordChangedAt && decoded.iat * 1000 < tailor.passwordChangedAt.getTime() - 1000) {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }

    req.tailor = tailor;
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
    next(err);
  }
};
