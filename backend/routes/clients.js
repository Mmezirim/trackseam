const router = require("express").Router();
const auth   = require("../middleware/auth");
const Client = require("../models/Client");


router.use(auth);

// GET /api/clients
router.get("/", async (req, res) => {
  try {
    const clients = await Client
      .find({ tailor: req.tailor._id }, "-measurements")
      .sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients/search?q=
router.get("/search", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json([]);
    const clients = await Client
      .find(
        { tailor: req.tailor._id, name: { $regex: q, $options: "i" } },
        "-measurements"
      )
      .sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients/:id
router.get("/:id", async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, tailor: req.tailor._id }, "-measurements");
    if (!client) return res.status(404).json({ error: "Client not found." });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients
router.post("/", async (req, res) => {
  try {
    const { clientId, name, phone, email, notes } = req.body;
    if (!name || !clientId)
      return res.status(400).json({ error: "name and clientId are required." });

    const client = await Client.create({
      tailor: req.tailor._id,
      clientId,
      name,
      phone,
      email,
      notes,
    });
    res.status(201).json(client);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: "Client ID already exists in your account." });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/clients/:id
router.delete("/:id", async (req, res) => {
  try {
    const result = await Client.findOneAndDelete({ _id: req.params.id, tailor: req.tailor._id });
    if (!result) return res.status(404).json({ error: "Client not found." });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;