import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const xavierId = 'cmnlvh28n0000ie04gtwkmfqi';
  const classId = 'cmnfipwrb0005qyas5fpwoceu'; // Classe Homens
  
  const updated = await prisma.user.update({
    where: { id: xavierId },
    data: { classId: classId }
  });
  
  console.log('--- VÍNCULO REALIZADO COM SUCESSO ---');
  console.log(JSON.stringify(updated, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
