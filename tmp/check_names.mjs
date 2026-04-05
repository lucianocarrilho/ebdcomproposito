import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'PROFESSOR' },
      select: { name: true, email: true }
    });
    
    console.log("=== PROFESSORES CADASTRADOS NA GESTÃO DE ACESSOS ===");
    users.forEach(u => console.log(`- ${u.name} (${u.email})`));

    const classes = await prisma.class.findMany({
      select: { name: true, professor: true }
    });
    
    console.log("\n=== NOMES DE PROFESSORES NAS CLASSES ===");
    classes.forEach(c => console.log(`${c.name}: ${c.professor}`));

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
