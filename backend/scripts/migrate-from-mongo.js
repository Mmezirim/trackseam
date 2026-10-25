// One-off copy of existing accounts from the old MongoDB database into MySQL.
//
//   MONGO_URI=... DATABASE_URL=... node scripts/migrate-from-mongo.js [--dry-run]
//
// Mongo ObjectIds are kept as the MySQL ids, and bcrypt password hashes are
// copied as-is, so existing users sign in with their current password. Safe to
// re-run: rows that already exist are skipped.
require("dotenv").config();
// Some Windows resolvers refuse the SRV lookup mongodb+srv:// needs;
// MONGO_DNS=8.8.8.8 routes it through a public resolver instead.
if (process.env.MONGO_DNS) require("dns").setServers(process.env.MONGO_DNS.split(","));
const { MongoClient } = require("mongodb");
const prisma = require("../lib/prisma");

const DRY_RUN = process.argv.includes("--dry-run");

const clip = (v, n) => (v == null ? "" : String(v).trim().slice(0, n));
const date = (v) => (v ? new Date(v) : new Date());

async function main() {
  if (!process.env.MONGO_URI) throw new Error("Set MONGO_URI to the old MongoDB connection string.");

  const mongo = new MongoClient(process.env.MONGO_URI);
  await mongo.connect();
  const db = mongo.db();

  const tailors = await db.collection("tailors").find().toArray();
  const clients = await db.collection("clients").find().toArray();
  const tailorIds = new Set(tailors.map((t) => String(t._id)));

  const tailorRows = tailors.map((t) => ({
    id:        String(t._id),
    shopName:  clip(t.shopName, 120) || "My Shop",
    email:     clip(t.email, 191).toLowerCase(),
    password:  t.password,
    createdAt: date(t.createdAt),
  }));

  const clientRows = [];
  const measurementRows = [];
  for (const c of clients) {
    if (!tailorIds.has(String(c.tailor))) continue; // orphaned client
    clientRows.push({
      id:        String(c._id),
      tailorId:  String(c.tailor),
      clientId:  clip(c.clientId, 20),
      name:      clip(c.name, 120),
      phone:     clip(c.phone, 40),
      email:     clip(c.email, 191),
      notes:     clip(c.notes, 5000),
      createdAt: date(c.createdAt),
    });
    for (const m of c.measurements || []) {
      measurementRows.push({
        id:          String(m._id),
        clientRefId: String(c._id),
        outfitType:  clip(m.outfitType, 60),
        description: clip(m.description, 255),
        fields:      JSON.stringify(m.fields || {}),
        notes:       clip(m.notes, 5000),
        createdAt:   date(m.createdAt),
      });
    }
  }

  console.log(`Found ${tailorRows.length} tailors, ${clientRows.length} clients, ${measurementRows.length} measurements.`);

  if (!DRY_RUN) {
    const t = await prisma.tailor.createMany({ data: tailorRows, skipDuplicates: true });
    const c = await prisma.client.createMany({ data: clientRows, skipDuplicates: true });
    const m = await prisma.measurement.createMany({ data: measurementRows, skipDuplicates: true });
    console.log(`Inserted ${t.count} tailors, ${c.count} clients, ${m.count} measurements.`);
  } else {
    console.log("Dry run: nothing written.");
  }

  await mongo.close();
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
