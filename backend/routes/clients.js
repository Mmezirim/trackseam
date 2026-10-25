const router    = require("express").Router();
const auth      = require("../middleware/auth");
const prisma    = require("../lib/prisma");
const serialize = require("../lib/serialize");
const { str, tooLong } = require("../lib/validate");

router.use(auth);

const LIMITS = { clientId: 20, name: 120, phone: 40, email: 191, notes: 5000 };

// GET /api/clients
router.get("/", async (req, res, next) => {
  try {
    const clients = await prisma.client.findMany({
      where:   { tailorId: req.tailor.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(clients.map(serialize.client));
  } catch (err) {
    next(err);
  }
});

// GET /api/clients/search?q=
router.get("/search", async (req, res, next) => {
  try {
    const q = str(req.query.q).slice(0, 120);
    if (!q) return res.json([]);
    // The default MySQL collation is case-insensitive, so contains matches
    // regardless of case.
    const clients = await prisma.client.findMany({
      where:   { tailorId: req.tailor.id, name: { contains: q } },
      orderBy: { createdAt: "desc" },
    });
    res.json(clients.map(serialize.client));
  } catch (err) {
    next(err);
  }
});

// GET /api/clients/:id
router.get("/:id", async (req, res, next) => {
  try {
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, tailorId: req.tailor.id },
    });
    if (!client) return res.status(404).json({ error: "Client not found." });
    res.json(serialize.client(client));
  } catch (err) {
    next(err);
  }
});

// POST /api/clients
router.post("/", async (req, res, next) => {
  try {
    const data = {
      clientId: str(req.body.clientId),
      name:     str(req.body.name),
      phone:    str(req.body.phone),
      email:    str(req.body.email),
      notes:    str(req.body.notes),
    };
    if (!data.name || !data.clientId)
      return res.status(400).json({ error: "name and clientId are required." });

    const long = tooLong(LIMITS, data);
    if (long) return res.status(400).json({ error: `${long} is too long (max ${LIMITS[long]} characters).` });

    const client = await prisma.client.create({ data: { ...data, tailorId: req.tailor.id } });
    res.status(201).json(serialize.client(client));
  } catch (err) {
    if (err.code === "P2002")
      return res.status(409).json({ error: "Client ID already exists in your account." });
    next(err);
  }
});

// DELETE /api/clients/:id — measurements go with it via ON DELETE CASCADE.
router.delete("/:id", async (req, res, next) => {
  try {
    const { count } = await prisma.client.deleteMany({
      where: { id: req.params.id, tailorId: req.tailor.id },
    });
    if (!count) return res.status(404).json({ error: "Client not found." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
