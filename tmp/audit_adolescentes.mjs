import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const classItem = await prisma.class.findFirst({
      where: { name: 'Adolescentes' }
    });

    if (!classItem) {
      console.log("Classe Adolescentes não encontrada.");
      process.exit(0);
    }

    const students = await prisma.student.findMany({
      where: { classId: classItem.id },
      select: { id: true, name: true, active: true }
    });
    
    console.log(`=== ALUNOS NA CLASSE ADOLESCENTES (ID: ${classItem.id}) ===`);
    students.forEach(s => {
      console.log(`- Nome: [${s.name}] | Ativo: ${s.active} | ID: ${s.id}`);
    });

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
