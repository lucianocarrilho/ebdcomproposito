import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const mapping = [
    { email: 'santanaamara85@gmail.com', classId: 'cmnfipwyq0006qyas7tjsp22a' }, // Mulheres
    { email: 'devoraaline13@gmail.com', classId: 'cmnfipw260002qyas860frdhm' }, // Crianças
    { email: 'lucianalinaracarrilho@gmail.com', classId: 'cmnl3te7d0000l404gk3akvvv' } // Discipulado
  ];
  
  console.log('--- EXECUTANDO REPARO EM MASSA ---');
  for (const item of mapping) {
    const updated = await prisma.user.update({
      where: { email: item.email },
      data: { classId: item.classId }
    });
    console.log(`✅ ${updated.name} vinculado com sucesso!`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
