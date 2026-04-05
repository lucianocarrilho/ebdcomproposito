const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const classJovens = await prisma.class.findFirst({
      where: { name: { contains: 'Jovens' } }
    });

    if (!classJovens) {
      console.log('CLASSE_NAO_ENCONTRADA_OU_EXCLUIDA');
      return;
    }

    // 1. Apagar os estudantes vinculados
    const delStudents = await prisma.student.deleteMany({
      where: { classId: classJovens.id }
    });
    console.log('ESTUDANTES_APAGADOS:', delStudents.count);

    // 2. Apagar a classe
    await prisma.class.delete({
      where: { id: classJovens.id }
    });
    console.log('CLASSE_JOVENS_EXCLUIDA_COM_SUCESSO');

  } catch (error) {
    console.error('ERRO:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
