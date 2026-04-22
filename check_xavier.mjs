import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const xavier = await prisma.user.findUnique({
    where: { email: 'xaviermoraes27@gmail.com' },
    include: { class: true }
  });
  
  const classes = await prisma.class.findMany();
  
  console.log('--- DADOS DO PROFESSOR ---');
  console.log(JSON.stringify(xavier, null, 2));
  console.log('\n--- CLASSES DISPONÍVEIS ---');
  console.log(JSON.stringify(classes, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
