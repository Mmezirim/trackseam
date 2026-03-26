const router  = require("express").Router();
const jwt     = require("jsonwebtoken");
const Tailor  = require("../models/Tailor");
const auth    = require("../middleware/auth");

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

module.exports = router;