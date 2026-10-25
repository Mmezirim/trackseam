const router    = require("express").Router();
const auth      = require("../middleware/auth");
const prisma    = require("../lib/prisma");
const serialize = require("../lib/serialize");
const { str, tooLong, UNITS } = require("../lib/validate");

router.use(auth);

const LIMITS = { outfitType: 60, description: 255, notes: 5000 };
const MAX_FIELDS = 60;

const ownedClient = (req) =>
  prisma.client.findFirst({ where: { id: req.params.id, tailorId: req.tailor.id } });

// Accepts { name: value } and returns a clean copy, or null if malformed.
const cleanFields = (fields) => {
  if (fields == null) return {};
  if (typeof fields !== "object" || Array.isArray(fields)) return null;
  const entries = Object.entries(fields);
  if (entries.length > MAX_FIELDS) return null;
  const out = {};
  for (const [k, v] of entries) {
    const key = String(k).trim().slice(0, 60);
    if (!key) continue;
    out[key] = v == null ? "" : String(v).trim().slice(0, 20);
  }
  return out;
};

// GET /api/clients/:id/measurements
router.get("/:id/measurements", async (req, res, next) => {
  try {
    const client = await ownedClient(req);
    if (!client) return res.status(404).json({ error: "Client not found." });

    const measurements = await prisma.measurement.findMany({
      where:   { clientRefId: client.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(measurements.map(serialize.measurement));
  } catch (err) {
    next(err);
  }
});

// POST /api/clients/:id/measurements
router.post("/:id/measurements", async (req, res, next) => {
  try {
    const data = {
      outfitType:  str(req.body.outfitType),
      description: str(req.body.description),
      notes:       str(req.body.notes),
    };
    if (!data.outfitType || !data.description)
      return res.status(400).json({ error: "outfitType and description are required." });

    const long = tooLong(LIMITS, data);
    if (long) return res.status(400).json({ error: `${long} is too long (max ${LIMITS[long]} characters).` });

    // App versions before units existed always meant centimetres.
    const unit = req.body.unit === undefined ? "cm" : req.body.unit;
    if (!UNITS.includes(unit))
      return res.status(400).json({ error: `unit must be one of: ${UNITS.join(", ")}.` });

    const fields = cleanFields(req.body.fields);
    if (!fields) return res.status(400).json({ error: `fields must be an object with at most ${MAX_FIELDS} entries.` });

    const client = await ownedClient(req);
    if (!client) return res.status(404).json({ error: "Client not found." });

    const saved = await prisma.measurement.create({
      data: { ...data, unit, fields: JSON.stringify(fields), clientRefId: client.id },
    });
    res.status(201).json(serialize.measurement(saved));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/clients/:id/measurements/:measId
router.delete("/:id/measurements/:measId", async (req, res, next) => {
  try {
    const client = await ownedClient(req);
    if (!client) return res.status(404).json({ error: "Client not found." });

    const { count } = await prisma.measurement.deleteMany({
      where: { id: req.params.measId, clientRefId: client.id },
    });
    if (!count) return res.status(404).json({ error: "Measurement not found." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
