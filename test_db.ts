import "dotenv/config";
import { prisma } from "./src/lib/prisma";

async function main() {
  try {
    const res = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'lessons'`;
    console.log("Columns:", res);
  } catch (err) {
    console.error("Error:", err);
  } finally {
  }
}

main();
