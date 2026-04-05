import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    // Apagar todas as justificativas que foram usadas para teste
    const deleted = await prisma.absenceJustification.deleteMany({});
    
    console.log(`Faxina completa! ${deleted.count} justificativas de teste foram removidas.`);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
