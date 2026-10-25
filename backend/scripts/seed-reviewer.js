// Creates (or resets) a demo tailor account with sample clients, for App Store /
// Play reviewers and TestFlight testers:
//
//   node scripts/seed-reviewer.js <login> <password> ["Shop name"]
//
// The login is stored as the account's email field. Re-running resets the
// password and replaces the sample data, so it's safe to run before each review.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");

const [login, password, shopName = "Adire Atelier (Demo)"] = process.argv.slice(2);

const CLIENTS = [
  {
    clientId: "DEMO01", name: "Amara Okonkwo", phone: "+234 803 555 0101", email: "",
    notes: "Prefers a slim fit. Collects on Saturdays.",
    measurements: [
      { outfitType: "Agbada", description: "Wedding agbada, white & gold", unit: "in", notes: "Hand embroidery on the neckline.",
        fields: { Chest: "42", Waist: "36", Shoulder: "18.5", "Sleeve Length": "25", "Gown Length": "58", "Trouser Waist": "35", Inseam: "31" } },
      { outfitType: "Shirt", description: "Everyday senator shirt", unit: "in", notes: "",
        fields: { Chest: "42", Waist: "36", Shoulder: "18.5", "Sleeve Length": "24.5", "Back Length": "30", Neck: "16" } },
    ],
  },
  {
    clientId: "DEMO02", name: "Funke Adeyemi", phone: "+234 802 555 0123", email: "",
    notes: "Bridal client. Second fitting booked.",
    measurements: [
      { outfitType: "Dress", description: "Reception dress, lace", unit: "in", notes: "Leave 1 in seam allowance at the waist.",
        fields: { Bust: "36", Waist: "29", Hip: "40", Shoulder: "15", "Sleeve Length": "22", "Dress Length": "56", Back: "15.5" } },
    ],
  },
  {
    clientId: "DEMO03", name: "Chidi Eze", phone: "+234 806 555 0144", email: "",
    notes: "",
    measurements: [
      { outfitType: "Suit", description: "Navy two-piece", unit: "cm", notes: "Measured in cm at the client's request.",
        fields: { Chest: "104", Waist: "88", Hip: "102", Shoulder: "46", "Sleeve Length": "63", "Jacket Length": "76", "Trouser Waist": "86", Inseam: "80" } },
    ],
  },
];

async function main() {
  if (!login || !password) {
    throw new Error("Usage: node scripts/seed-reviewer.js <login> <password> [\"Shop name\"]");
  }
  const email = login.trim().toLowerCase();
  const hash = await bcrypt.hash(password, 12);

  const tailor = await prisma.tailor.upsert({
    where:  { email },
    update: { password: hash, shopName, preferredUnit: "in", passwordChangedAt: new Date() },
    create: { email, password: hash, shopName, preferredUnit: "in" },
  });

  // Fresh sample data each run (measurements cascade with their clients).
  await prisma.client.deleteMany({ where: { tailorId: tailor.id } });
  for (const { measurements, ...client } of CLIENTS) {
    const created = await prisma.client.create({ data: { ...client, tailorId: tailor.id } });
    for (const m of measurements) {
      await prisma.measurement.create({
        data: { ...m, fields: JSON.stringify(m.fields), clientRefId: created.id },
      });
    }
  }

  console.log(`Demo account ready: login "${email}", shop "${shopName}", ${CLIENTS.length} clients.`);
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
