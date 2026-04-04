import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function audit() {
  console.log("--- Auditoria de Classes ---");
  const classes = await prisma.class.findMany({ select: { id: true, name: true } });
  classes.forEach(c => console.log(`Classe: ${c.name} | ID: ${c.id}`));

  console.log("\n--- Auditoria do Usuário Jonatas ---");
  const user = await prisma.user.findFirst({
    where: { name: { contains: "Jonatas" } }
  });

  if (user) {
    console.log(`Usuário: ${user.name}`);
    console.log(`Role: ${user.role}`);
    console.log(`ClassID atual: ${user.classId || "NULO (Problema identificado!)"}`);
    
    // Se encontrarmos a classe Adolescentes, vamos sugerir o update
    const adolescentes = classes.find(c => c.name.toLowerCase().includes("adolescente"));
    if (adolescentes) {
       console.log(`\nSugerindo vínculo com a classe: ${adolescentes.name} (${adolescentes.id})`);
    }
  } else {
    console.log("Usuário não encontrado.");
  }
}

audit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
