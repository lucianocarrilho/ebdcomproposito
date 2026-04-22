import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const professors = await prisma.user.findMany({
    where: { role: 'PROFESSOR' },
    include: { class: true }
  });
  
  console.log('--- AUDITORIA DE PROFESSORES ---');
  professors.forEach(p => {
    console.log(`${p.name} (${p.email}): Classe = ${p.class ? p.class.name : 'SEM CLASSE ⚠️'}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
