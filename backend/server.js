require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes        = require("./routes/auth");
const clientRoutes      = require("./routes/clients");
const measurementRoutes = require("./routes/measurements");

const app = express();

// MIDDLEWARE
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:3002",
  credentials: true,
}));
app.use(express.json());

// DATABASE
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/tailorbook")
  .then(() => console.log("✓ MongoDB connected"))
  .catch((err) => console.error("✗ MongoDB error:", err));

// ROUTES
app.use("/api/auth",         authRoutes);
app.use("/api/clients",      clientRoutes);
app.use("/api/clients",      measurementRoutes);

// HEALTH CHECK
app.get("/api/health", (_, res) => res.json({ status: "ok" }));

// GLOBAL ERROR HANDLER
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✓ Trackseam API running on http://localhost:${PORT}`)
);