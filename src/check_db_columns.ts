import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$queryRaw`DESCRIBE classes`;
    console.log("Colunas na tabela 'classes':");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Erro ao verificar tabela:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
