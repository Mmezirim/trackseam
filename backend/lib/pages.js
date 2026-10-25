// Public pages (privacy policy, terms, support, account deletion, password
// reset). The API serves them, and scripts/build-website.js writes the same
// pages as static files for trackseam.com, so both copies stay identical.
const fs   = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const ASSETS_DIR = path.join(PUBLIC_DIR, "legal-assets");

const PAGES = {
  "/":               ["index",          "Client Measurement Records"],
  "/privacy":        ["privacy",        "Privacy Policy"],
  "/terms":          ["terms",          "Terms of Use"],
  "/support":        ["support",        "Support"],
  "/delete-account": ["delete-account", "Delete your account"],
  "/reset-password": ["reset-password", "Reset password"],
};

const pageVars = (overrides = {}) => ({
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || "contact@trackseam.com",
  LEGAL_ENTITY:  process.env.LEGAL_ENTITY  || "Trackseam",
  GOVERNING_LAW: process.env.GOVERNING_LAW || "the Federal Republic of Nigeria",
  // Empty means "same origin"; the static website copy points at the API host.
  API_BASE:      "",
  ...overrides,
});

const fill = (html, vars) => html.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in vars ? vars[key] : m));

const renderPage = (file, title, vars) => {
  const layout = fs.readFileSync(path.join(PUBLIC_DIR, "layout.html"), "utf8");
  const body   = fs.readFileSync(path.join(PUBLIC_DIR, "pages", `${file}.html`), "utf8");
  return fill(fill(layout, { TITLE: title, BODY: body }), vars);
};

module.exports = { PAGES, ASSETS_DIR, pageVars, renderPage };
