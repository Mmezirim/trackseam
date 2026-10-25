// Small input helpers. Column sizes here must match prisma/schema.prisma.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (v) => (typeof v === "string" ? v.trim() : "");

const isEmail = (v) => EMAIL_RE.test(v) && v.length <= 191;

const tooLong = (limits, values) =>
  Object.keys(limits).find((k) => (values[k] || "").length > limits[k]);

// Measurement units the app supports. Keep in sync with UNITS in frontend/App.jsx.
const UNITS = ["in", "cm"];

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt ignores bytes past 72

const passwordProblem = (pw) => {
  if (typeof pw !== "string" || !pw) return "Password is required.";
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (pw.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters.`;
  return null;
};

module.exports = { str, isEmail, tooLong, passwordProblem, UNITS };
