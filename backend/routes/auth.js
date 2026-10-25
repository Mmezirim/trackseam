const router    = require("express").Router();
const jwt       = require("jsonwebtoken");
const crypto    = require("crypto");
const bcrypt    = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const prisma    = require("../lib/prisma");
const auth      = require("../middleware/auth");
const serialize = require("../lib/serialize");
const { str, isEmail, passwordProblem, UNITS } = require("../lib/validate");
const { sendResetEmail } = require("../utils/mailer");

const BCRYPT_ROUNDS = 12;

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const hashResetToken = (plain) => crypto.createHash("sha256").update(plain).digest("hex");

// Brute-force protection for endpoints that take a password or send email.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many reset requests. Please try again later." },
});

// POST /api/auth/register
router.post("/register", credentialLimiter, async (req, res, next) => {
  try {
    const shopName = str(req.body.shopName);
    const email    = str(req.body.email).toLowerCase();
    const { password } = req.body;

    if (!shopName || !email || !password)
      return res.status(400).json({ error: "Shop name, email and password are required." });
    if (shopName.length > 120)
      return res.status(400).json({ error: "Shop name must be 120 characters or fewer." });
    if (!isEmail(email))
      return res.status(400).json({ error: "Please enter a valid email address." });

    const pwError = passwordProblem(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const exists = await prisma.tailor.findUnique({ where: { email } });
    if (exists)
      return res.status(409).json({ error: "An account with this email already exists." });

    const tailor = await prisma.tailor.create({
      data: { shopName, email, password: await bcrypt.hash(password, BCRYPT_ROUNDS) },
    });

    res.status(201).json({ token: signToken(tailor.id), tailor: serialize.tailor(tailor) });
  } catch (err) {
    if (err.code === "P2002")
      return res.status(409).json({ error: "An account with this email already exists." });
    next(err);
  }
});

// POST /api/auth/login
router.post("/login", credentialLimiter, async (req, res, next) => {
  try {
    const email = str(req.body.email).toLowerCase();
    const { password } = req.body;

    if (!email || typeof password !== "string" || !password)
      return res.status(400).json({ error: "Email and password are required." });

    const tailor = await prisma.tailor.findUnique({ where: { email } });
    const valid  = tailor && (await bcrypt.compare(password, tailor.password));
    if (!valid)
      return res.status(401).json({ error: "Invalid email or password." });

    res.json({ token: signToken(tailor.id), tailor: serialize.tailor(tailor) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get("/me", auth, (req, res) => {
  res.json({ tailor: serialize.tailor(req.tailor) });
});

// PATCH /api/auth/me — { shopName?, preferredUnit? }
router.patch("/me", auth, async (req, res, next) => {
  try {
    const data = {};
    if (req.body.shopName !== undefined) {
      const shopName = str(req.body.shopName);
      if (!shopName)
        return res.status(400).json({ error: "Shop name is required." });
      if (shopName.length > 120)
        return res.status(400).json({ error: "Shop name must be 120 characters or fewer." });
      data.shopName = shopName;
    }
    if (req.body.preferredUnit !== undefined) {
      if (!UNITS.includes(req.body.preferredUnit))
        return res.status(400).json({ error: `preferredUnit must be one of: ${UNITS.join(", ")}.` });
      data.preferredUnit = req.body.preferredUnit;
    }
    if (!Object.keys(data).length)
      return res.status(400).json({ error: "Nothing to update." });

    const tailor = await prisma.tailor.update({
      where: { id: req.tailor.id },
      data,
    });
    res.json({ tailor: serialize.tailor(tailor) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/me — permanently deletes the account, its clients and
// their measurements. Required by the App Store and Google Play.
router.delete("/me", credentialLimiter, auth, async (req, res, next) => {
  try {
    const { password } = req.body || {};
    const valid = typeof password === "string" && (await bcrypt.compare(password, req.tailor.password));
    // 403, not 401: the session is fine, only the confirmation failed.
    if (!valid)
      return res.status(403).json({ error: "Password is incorrect." });

    // Client and Measurement rows go with it via ON DELETE CASCADE.
    await prisma.tailor.delete({ where: { id: req.tailor.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", emailLimiter, async (req, res) => {
  const generic = { message: "If that email is registered, a reset link has been sent." };
  try {
    const email = str(req.body.email).toLowerCase();
    if (!email)
      return res.status(400).json({ error: "Email address is required." });

    const tailor = await prisma.tailor.findUnique({ where: { email } });

    // Same answer whether or not the email exists, so accounts can't be enumerated.
    if (!tailor) return res.json(generic);

    // Only the SHA-256 hash is stored; the plaintext token exists only in the email.
    const plainToken = crypto.randomBytes(32).toString("hex");

    await prisma.tailor.update({
      where: { id: tailor.id },
      data: {
        passwordResetToken:   hashResetToken(plainToken),
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const base     = (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
    const resetUrl = `${base}/reset-password?token=${plainToken}`;

    await sendResetEmail(tailor.email, tailor.shopName, resetUrl);

    res.json(generic);
  } catch (err) {
    console.error("[forgot-password]", err.message);
    res.status(500).json({ error: "Could not send reset email. Please try again later." });
  }
});

// POST /api/auth/reset-password/:token
router.post("/reset-password/:token", credentialLimiter, async (req, res, next) => {
  try {
    const { password } = req.body;
    const pwError = passwordProblem(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const tailor = await prisma.tailor.findFirst({
      where: {
        passwordResetToken:   hashResetToken(req.params.token),
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!tailor)
      return res.status(400).json({ error: "Reset link is invalid or has expired." });

    const updated = await prisma.tailor.update({
      where: { id: tailor.id },
      data: {
        password:             await bcrypt.hash(password, BCRYPT_ROUNDS),
        passwordResetToken:   null,
        passwordResetExpires: null,
        passwordChangedAt:    new Date(),
      },
    });

    res.json({
      message: "Password reset successful.",
      token:   signToken(updated.id),
      tailor:  serialize.tailor(updated),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
