const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://u223033896_ebd2026:Eulk2180263%23@srv890.hstgr.io:3306/u223033896_ebd2026'
    }
  }
});

async function main() {
  // As datas estão como 2026-04-12T00:00:00.000Z (meia-noite UTC)
  // Vamos mover para 2026-04-12T12:00:00.000Z (meio-dia UTC) para máxima segurança
  const oldDate = new Date('2026-04-12T00:00:00.000Z');
  const newDate = new Date('2026-04-12T12:00:00.000Z');
  
  const result = await prisma.visitor.updateMany({
    where: { date: oldDate },
    data: { date: newDate }
  });

  console.log(`✅ ${result.count} visitantes corrigidos: meia-noite UTC → meio-dia UTC`);

  // Verificar
  const visitors = await prisma.visitor.findMany({ orderBy: { date: 'desc' }, take: 10 });
  console.log('\nDatas após correção:');
  visitors.forEach(v => {
    console.log(`  - ${v.name} | UTC: ${v.date.toISOString()} | BR: ${v.date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  });
}

main()
  .catch(e => console.error('Erro:', e))
  .finally(() => prisma.$disconnect());
