// Script para corrigir datas dos visitantes de 11/04 para 12/04/2026
// Esses visitantes foram registrados em 12/04 mas gravados com data UTC errada

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(
  'mysql://u223033896_ebd2026:Eulk2180263#@srv890.hstgr.io:3306/u223033896_ebd2026'
);

// Primeiro, listar os visitantes com data de 11/04
const [visitors] = await conn.execute(
  `SELECT id, name, date FROM visitors WHERE DATE(date) = '2026-04-11'`
);

console.log('Visitantes com data 11/04 (a corrigir):');
visitors.forEach(v => {
  console.log(`  - ${v.name} | data atual: ${v.date}`);
});

if (visitors.length === 0) {
  console.log('Nenhum visitante encontrado com data 11/04. Nada a corrigir.');
  await conn.end();
  process.exit(0);
}

// Corrigir para 12/04/2026 12:00:00 (meio-dia para evitar timezone shift)
const [result] = await conn.execute(
  `UPDATE visitors SET date = '2026-04-12 12:00:00' WHERE DATE(date) = '2026-04-11'`
);

console.log(`\n✅ ${result.affectedRows} visitantes corrigidos de 11/04 para 12/04/2026`);

// Verificar resultado
const [updated] = await conn.execute(
  `SELECT id, name, date FROM visitors WHERE DATE(date) = '2026-04-12'`
);

console.log('\nVisitantes após correção:');
updated.forEach(v => {
  console.log(`  - ${v.name} | data: ${v.date}`);
});

await conn.end();
