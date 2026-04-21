const router  = require("express").Router();
const jwt     = require("jsonwebtoken");
const crypto  = require("crypto");
const Tailor  = require("../models/Tailor");
const auth    = require("../middleware/auth");
const { sendResetEmail } = require("../utils/mailer");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { shopName, email, password } = req.body;

    if (!shopName?.trim() || !email?.trim() || !password)
      return res.status(400).json({ error: "shopName, email and password are required." });

    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });

    const exists = await Tailor.findOne({ email: email.toLowerCase() });
    if (exists)
      return res.status(409).json({ error: "An account with this email already exists." });

    const tailor = await Tailor.create({ shopName: shopName.trim(), email, password });
    const token  = signToken(tailor._id);

    res.status(201).json({ token, tailor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    const tailor = await Tailor.findOne({ email: email.toLowerCase() });
    if (!tailor)
      return res.status(401).json({ error: "Invalid email or password." });

    const valid = await tailor.comparePassword(password);
    if (!valid)
      return res.status(401).json({ error: "Invalid email or password." });

    const token = signToken(tailor._id);
    res.json({ token, tailor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get("/me", auth, (req, res) => {
  res.json({ tailor: req.tailor });
});

// PATCH /api/auth/me
router.patch("/me", auth, async (req, res) => {
  try {
    const { shopName } = req.body;
    if (!shopName?.trim())
      return res.status(400).json({ error: "shopName is required." });

    req.tailor.shopName = shopName.trim();
    await req.tailor.save();
    res.json({ tailor: req.tailor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
 
    if (!email?.trim())
      return res.status(400).json({ error: "Email address is required." });
 
    const tailor = await Tailor.findOne({ email: email.toLowerCase() });
 
    // Always return the same message whether or not the email exists,
    // so attackers cannot enumerate registered accounts.
    if (!tailor)
      return res.json({ message: "If that email is registered, a reset link has been sent." });
 
    // Generate a random 32-byte plaintext token.
    const plainToken  = crypto.randomBytes(32).toString("hex");
 
    // Store only the SHA-256 hash — the plaintext never touches the database.
    const hashedToken = crypto.createHash("sha256").update(plainToken).digest("hex");
 
    tailor.passwordResetToken   = hashedToken;
    tailor.passwordResetExpires = Date.now() + 60 * 60 * 1000; // expires in 1 hour
    await tailor.save();
 
    // Build the reset URL the frontend will open.
    //    The frontend reads the ?resetToken= query param and shows the
    //    ResetPasswordScreen (already integrated in App.jsx).
    const resetUrl = `${process.env.CLIENT_URL}?resetToken=${plainToken}`;
 
    // 4. Send the email via Nodemailer.
    await sendResetEmail(tailor.email, tailor.shopName, resetUrl);
 
    res.json({ message: "If that email is registered, a reset link has been sent." });
 
  } catch (err) {
    console.error("[forgot-password]", err.message);
    res.status(500).json({ error: "Could not send reset email. Please try again later." });
  }
});
 
// RESET PASSWORD
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { password } = req.body;
 
    if (!password)
      return res.status(400).json({ error: "New password is required." });
 
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });
 
    // Hash the incoming token to compare against the stored hash.
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");
 
    const tailor = await Tailor.findOne({
      passwordResetToken:   hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });
 
    if (!tailor)
      return res.status(400).json({ error: "Reset link is invalid or has expired." });
 
    // The Tailor model's pre-save hook hashes the password automatically.
    tailor.password             = password;
    tailor.passwordResetToken   = undefined;
    tailor.passwordResetExpires = undefined;
    await tailor.save();
 
    const token = signToken(tailor._id);
    res.json({ message: "Password reset successful.", token, tailor });
 
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;