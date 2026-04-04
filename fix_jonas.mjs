import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
  const ADOLESCENTES_ID = "cmnfipwcr0003qyasbkmbegcl"; // Classe Adolescentes
  
  const user = await prisma.user.updateMany({
    where: { name: { contains: "Jonatas" } },
    data: { classId: ADOLESCENTES_ID }
  });

  console.log(`Sucesso! ${user.count} usuário(s) atualizado(s) com a classe Adolescentes.`);
}

fix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
