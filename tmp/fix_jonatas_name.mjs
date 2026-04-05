import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    // Atualizar o nome do professor "Jonas" para "Jonatas" para bater com a Gestão de Acessos
    const updated = await prisma.class.updateMany({
      where: { professor: 'Jonas Martins' },
      data: { professor: 'Jonatas Martins' }
    });
    
    console.log(`Sucesso: ${updated.count} classes atualizadas para 'Jonatas Martins'.`);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
