const { PrismaClient } = require("@prisma/client");

// One client per process; it owns the connection pool sized by
// connection_limit in DATABASE_URL.
const prisma = new PrismaClient();

module.exports = prisma;
