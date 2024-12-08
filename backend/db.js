const { PrismaClient } = require("@prisma/client");

// Create a global instance to prevent multiple PrismaClient instances
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
