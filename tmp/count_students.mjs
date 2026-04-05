import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const classes = await prisma.class.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: { students: true }
        }
      }
    });
    
    console.log("=== CONTAGEM DE ALUNOS POR CLASSE ===");
    classes.forEach(c => {
      console.log(`${c.name}: ${c._count.students} alunos`);
    });
    
    const totalStudents = await prisma.student.count();
    console.log(`\nTotal Geral de Alunos no Banco: ${totalStudents}`);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
