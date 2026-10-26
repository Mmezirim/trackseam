require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const prisma  = require("./lib/prisma");
const { PAGES, ASSETS_DIR, pageVars, renderPage } = require("./lib/pages");

const authRoutes        = require("./routes/auth");
const clientRoutes      = require("./routes/clients");
const measurementRoutes = require("./routes/measurements");

for (const key of ["DATABASE_URL", "JWT_SECRET"]) {
  if (!process.env[key]) {
    console.error(`✗ Missing required environment variable ${key}. See .env.example.`);
    process.exit(1);
  }
}

const app = express();

// Render (and most hosts) sit behind one proxy; needed for correct client IPs
// in rate limiting and for req.protocol.
app.set("trust proxy", 1);

// MIDDLEWARE
app.use(helmet());

// Origins the native apps load from: Capacitor serves the bundled web app
// from https://localhost on Android and capacitor://localhost on iOS.
const NATIVE_ORIGINS = ["https://localhost", "http://localhost", "capacitor://localhost", "ionic://localhost"];
// app.trackseam.com is the web version of the app; trackseam.com hosts copies
// of the delete-account and reset-password pages.
const WEBSITE_ORIGINS = ["https://app.trackseam.com", "https://trackseam.com", "https://www.trackseam.com"];
const allowedOrigins = new Set([
  ...NATIVE_ORIGINS,
  ...WEBSITE_ORIGINS,
  ...(process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean),
]);

app.use(cors({
  origin: (origin, callback) => {
    // No Origin header: same-origin pages, curl, server-to-server.
    if (!origin || allowedOrigins.has(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    callback(null, false);
  },
}));
app.use(express.json({ limit: "100kb" }));

// PUBLIC PAGES — privacy policy, terms, support, account deletion and the
// password-reset page linked from emails. The store listings link here.
for (const [route, [file, title]] of Object.entries(PAGES)) {
  const html = renderPage(file, title, pageVars());
  app.get(route, (_req, res) => res.type("html").send(html));
}
app.use("/legal-assets", express.static(ASSETS_DIR, { maxAge: "1d" }));

// ROUTES
app.use("/api/auth",    authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/clients", measurementRoutes);

// HEALTH CHECK
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "ok" });
  } catch {
    res.status(503).json({ status: "degraded", db: "unreachable" });
  }
});

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// GLOBAL ERROR HANDLER — never leak internals to the client.
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ error: "Malformed JSON body." });
  if (err.type === "entity.too.large")
    return res.status(413).json({ error: "Request body too large." });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`✓ Trackseam API running on http://localhost:${PORT}`)
);

const shutdown = () => server.close(() => prisma.$disconnect().finally(() => process.exit(0)));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
