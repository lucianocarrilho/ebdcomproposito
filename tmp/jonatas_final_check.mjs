import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst({
      where: { name: 'Jonatas Martins' },
      select: { id: true, name: true, classId: true }
    });
    
    console.log("=== CADASTRO DO JONATAS NA GESTÃO DE ACESSOS ===");
    console.log(JSON.stringify(user, null, 2));

    const classes = await prisma.class.findMany({
      where: { professor: 'Jonatas Martins' },
      select: { id: true, name: true, _count: { select: { students: true } } }
    });
    
    console.log("\n=== TURMAS DO JONATAS NO BANCO ===");
    console.log(JSON.stringify(classes, null, 2));

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
