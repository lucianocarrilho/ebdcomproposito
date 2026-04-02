import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const leaders = await prisma.leader.findMany({ select: { name: true, role: true } });
  console.log(JSON.stringify(leaders, null, 2));
  await prisma.$disconnect();
}

main();
