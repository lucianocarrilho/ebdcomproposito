import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const leaders = await prisma.leader.findMany({
    where: { name: { contains: "Luciano" } },
    select: { id: true, name: true, active: true, role: true }
  });
  console.log("Resultados para Luciano:");
  console.log(JSON.stringify(leaders, null, 2));
  await prisma.$disconnect();
}

main();
