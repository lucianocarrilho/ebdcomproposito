const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const classJovens = await prisma.class.findFirst({
      where: { name: { contains: 'Jovens' } }
    });

    if (!classJovens) {
      console.log('CLASSE_NAO_ENCONTRADA');
      return;
    }

    const students = await prisma.student.findMany({
      where: { classId: classJovens.id },
      select: { name: true, active: true }
    });

    console.log('RESULTADO_BUSCA');
    console.log('Classe:', classJovens.name);
    console.log('ID:', classJovens.id);
    console.log('Alunos Vinculados:', JSON.stringify(students, null, 2));

  } catch (error) {
    console.error('ERRO:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
