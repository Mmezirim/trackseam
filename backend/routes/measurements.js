const router = require("express").Router();
const auth   = require("../middleware/auth");
const Client = require("../models/Client");

router.use(auth);

// GET /api/clients/:id/measurements 
router.get("/:id/measurements", async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, tailor: req.tailor._id });
    if (!client) return res.status(404).json({ error: "Client not found." });

    const sorted = [...client.measurements].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients/:id/measurements
router.post("/:id/measurements", async (req, res) => {
  try {
    const { outfitType, description, fields, notes } = req.body;
    if (!outfitType || !description)
      return res.status(400).json({ error: "outfitType and description are required." });

    const client = await Client.findOne({ _id: req.params.id, tailor: req.tailor._id });
    if (!client) return res.status(404).json({ error: "Client not found." });

    client.measurements.push({ outfitType, description, fields, notes });
    await client.save();

    const saved = client.measurements[client.measurements.length - 1];
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/clients/:id/measurements/:measId
router.delete("/:id/measurements/:measId", async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, tailor: req.tailor._id });
    if (!client) return res.status(404).json({ error: "Client not found." });

    client.measurements.pull({ _id: req.params.measId });
    await client.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;