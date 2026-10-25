// Writes the public pages as static files for trackseam.com:
//
//   node scripts/build-website.js        -> ../website/
//
// Each page goes to <name>/index.html so /privacy, /terms etc. work on any
// static host. The home page is skipped so the existing site isn't replaced.
// Upload the contents of website/ into the site root (Hostinger: public_html).
require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const { PAGES, ASSETS_DIR, pageVars, renderPage } = require("../lib/pages");

const OUT      = path.join(__dirname, "..", "..", "website");
const API_BASE = (process.env.WEBSITE_API_BASE || "https://trackseam.onrender.com").replace(/\/+$/, "");

// Only replace what this script generates; website/ also holds hand-written
// files (index.html, store-buttons.js).
for (const [route, [file, title]] of Object.entries(PAGES)) {
  if (route === "/") continue;
  const dir = path.join(OUT, route.slice(1));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), renderPage(file, title, pageVars({ API_BASE })));
}

fs.rmSync(path.join(OUT, "legal-assets"), { recursive: true, force: true });
fs.cpSync(ASSETS_DIR, path.join(OUT, "legal-assets"), { recursive: true });

console.log(`Wrote ${OUT} (API: ${API_BASE})`);
