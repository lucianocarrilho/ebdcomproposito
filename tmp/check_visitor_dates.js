const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://u223033896_ebd2026:Eulk2180263%23@srv890.hstgr.io:3306/u223033896_ebd2026'
    }
  }
});

async function main() {
  // Listar TODOS os visitantes para ver as datas
  const visitors = await prisma.visitor.findMany({
    orderBy: { date: 'desc' },
    take: 20
  });

  console.log(`Total de visitantes recentes (${visitors.length}):`);
  visitors.forEach(v => {
    console.log(`  - ${v.name} | date: ${v.date.toISOString()} | local: ${v.date.toLocaleDateString('pt-BR')}`);
  });
}

main()
  .catch(e => console.error('Erro:', e))
  .finally(() => prisma.$disconnect());
