import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: "Jonas" } },
        { name: { contains: "Martins" } }
      ]
    }
  });
  
  if (users.length > 0) {
    console.log(`Encontrados ${users.length} usuários:`);
    users.forEach(user => {
      console.log("------------------------------------------");
      console.log("- Nome:", user.name);
      console.log("- Email:", user.email);
      console.log("- Role:", user.role);
      console.log("- Status:", user.active ? "Ativo" : "Inativo");
    });
    console.log("------------------------------------------");
  } else {
    console.log("Nenhum usuário Jonas ou Martins encontrado.");
  }
}

checkUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
