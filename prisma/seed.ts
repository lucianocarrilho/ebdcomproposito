import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Role values
const Role = { ADMIN: "ADMIN" as const, APOIO: "APOIO" as const };

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...\n");

  // Settings
  const settings = await prisma.settings.create({
    data: {
      churchName: "Igreja Assembleia de Deus",
      currentQuarter: "2026-Q1",
    },
  });
  console.log("⛪ Configurações criadas");

  // Admin User
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.create({
    data: {
      name: "Administrador",
      email: "admin@ebdcomproposito.com",
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });
  console.log("👤 Usuário admin criado (admin@ebdcomproposito.com / admin123)");

  // Classes
  const classesData = [
    { name: "Crianças", description: "Classe para crianças de 4 a 11 anos", audience: "Crianças" },
    { name: "Adolescentes", description: "Classe para adolescentes de 12 a 17 anos", audience: "Adolescentes" },
    { name: "Jovens", description: "Classe para jovens de 18 a 30 anos", audience: "Jovens" },
    { name: "Homens", description: "Classe para homens adultos", audience: "Adultos Homens" },
    { name: "Mulheres", description: "Classe para mulheres adultas", audience: "Adultas Mulheres" },
  ];

  const classes = [];
  for (const cls of classesData) {
    const created = await prisma.class.create({ data: cls });
    classes.push(created);
  }
  console.log(`📚 ${classes.length} classes criadas`);

  // Leaders
  const leadersData = [
    { name: "Pastor João Silva", role: "Dirigente", phone: "(11) 99999-1000", email: "pastor@igreja.com", classId: null },
    { name: "Irmã Ana Paula", role: "Vice-Dirigente", phone: "(11) 99999-1006", email: "ana@igreja.com", classId: null },
    { name: "Irmã Maria Santos", role: "Professor", phone: "(11) 99999-1001", email: "maria@igreja.com", classId: classes[0].id },
    { name: "Irmão Carlos Lima", role: "Professor", phone: "(11) 99999-1002", email: "carlos@igreja.com", classId: classes[1].id },
    { name: "Irmã Juliana Costa", role: "Professor", phone: "(11) 99999-1003", email: "juliana@igreja.com", classId: classes[2].id },
    { name: "Irmão Roberto Oliveira", role: "Professor", phone: "(11) 99999-1004", email: "roberto@igreja.com", classId: classes[3].id },
    { name: "Irmã Raquel Ferreira", role: "Professor", phone: "(11) 99999-1005", email: "raquel@igreja.com", classId: classes[4].id },
  ];

  for (const leader of leadersData) {
    await prisma.leader.create({ data: leader });
  }
  console.log(`👑 ${leadersData.length} líderes criados`);

  // Students
  const studentsData = [
    // Crianças
    { name: "Isabela Martins", gender: "F", birthDate: new Date("2015-03-12"), phone: "(11) 99999-0006", classId: classes[0].id, guardian: "Fernanda Martins" },
    { name: "Gabriel Santos", gender: "M", birthDate: new Date("2016-07-22"), phone: "(11) 99999-0010", classId: classes[0].id, guardian: "Paulo Santos" },
    { name: "Sophia Lima", gender: "F", birthDate: new Date("2017-01-15"), phone: "(11) 99999-0011", classId: classes[0].id, guardian: "Carla Lima" },
    // Adolescentes
    { name: "Pedro Henrique Costa", gender: "M", birthDate: new Date("2008-05-10"), phone: "(11) 99999-0004", classId: classes[1].id, guardian: "Marcos Costa", newConvert: true },
    { name: "Larissa Souza", gender: "F", birthDate: new Date("2009-09-30"), phone: "(11) 99999-0012", classId: classes[1].id, guardian: "Maria Souza" },
    // Jovens
    { name: "Ana Paula Ferreira", gender: "F", birthDate: new Date("2002-12-20"), phone: "(11) 99999-0003", classId: classes[2].id, baptized: true, member: true },
    { name: "Lucas Oliveira Santos", gender: "M", birthDate: new Date("2001-07-25"), phone: "(11) 99999-0005", classId: classes[2].id, baptized: true, member: true },
    { name: "Camila Rodrigues", gender: "F", birthDate: new Date("2000-04-18"), phone: "(11) 99999-0013", classId: classes[2].id, baptized: true, member: true },
    // Homens
    { name: "João Santos Lima", gender: "M", birthDate: new Date("1988-08-15"), phone: "(11) 99999-0002", classId: classes[3].id, baptized: true, member: true },
    { name: "Carlos Eduardo Souza", gender: "M", birthDate: new Date("1975-11-30"), phone: "(11) 99999-0007", classId: classes[3].id, baptized: true, member: true },
    { name: "Roberto Pereira", gender: "M", birthDate: new Date("1982-02-14"), phone: "(11) 99999-0014", classId: classes[3].id, baptized: true, member: true },
    // Mulheres
    { name: "Maria Silva Oliveira", gender: "F", birthDate: new Date("1995-04-02"), phone: "(11) 99999-0001", classId: classes[4].id, baptized: true, member: true },
    { name: "Juliana Rodrigues", gender: "F", birthDate: new Date("1990-06-18"), phone: "(11) 99999-0008", classId: classes[4].id, baptized: true, member: true },
    { name: "Raquel Santos", gender: "F", birthDate: new Date("1985-10-05"), phone: "(11) 99999-0015", classId: classes[4].id, baptized: true, member: true },
  ];

  for (const student of studentsData) {
    await prisma.student.create({ data: student });
  }
  console.log(`🎓 ${studentsData.length} alunos criados`);

  // Lessons
  const lessons = [
    { number: 1, title: "A Criação do Mundo", bibleText: "Gênesis 1:1-31", date: new Date("2026-01-04") },
    { number: 2, title: "O Pecado Original", bibleText: "Gênesis 3:1-24", date: new Date("2026-01-11") },
    { number: 3, title: "O Chamado de Abraão", bibleText: "Gênesis 12:1-9", date: new Date("2026-01-18") },
    { number: 4, title: "A Fidelidade de José", bibleText: "Gênesis 37-50", date: new Date("2026-01-25") },
    { number: 5, title: "Moisés e o Êxodo", bibleText: "Êxodo 14:1-31", date: new Date("2026-02-01") },
    { number: 6, title: "Os Dez Mandamentos", bibleText: "Êxodo 20:1-17", date: new Date("2026-02-08") },
    { number: 7, title: "A Terra Prometida", bibleText: "Josué 1:1-9", date: new Date("2026-02-15") },
    { number: 8, title: "Os Juízes de Israel", bibleText: "Juízes 2:16-23", date: new Date("2026-02-22") },
    { number: 9, title: "O Rei Davi", bibleText: "1 Samuel 16:1-13", date: new Date("2026-03-01") },
    { number: 10, title: "A Sabedoria de Salomão", bibleText: "1 Reis 3:5-14", date: new Date("2026-03-08") },
    { number: 11, title: "Os Profetas de Deus", bibleText: "Isaías 6:1-8", date: new Date("2026-03-15") },
    { number: 12, title: "O Exílio e o Retorno", bibleText: "Esdras 1:1-11", date: new Date("2026-03-22") },
    { number: 13, title: "A Esperança Messiânica", bibleText: "Isaías 53:1-12", date: new Date("2026-03-29") },
  ];

  for (const lesson of lessons) {
    await prisma.lesson.create({
      data: {
        ...lesson,
        quarter: "2026-Q1",
        status: lesson.date < new Date() ? "concluída" : "pendente",
      },
    });
  }
  console.log(`📖 ${lessons.length} lições criadas`);

  // Events
  const eventsData = [
    { title: "Início do 1º Trimestre", date: new Date("2026-01-01"), type: "trimestre" },
    { title: "Fim do 1º Trimestre", date: new Date("2026-03-31"), type: "trimestre" },
    { title: "Dia das Mães - Homenagem Especial", date: new Date("2026-05-10"), type: "comemorativo" },
    { title: "Dia dos Pais - Homenagem Especial", date: new Date("2026-08-09"), type: "comemorativo" },
    { title: "Dia da Bíblia", date: new Date("2026-12-12"), type: "comemorativo" },
  ];

  for (const event of eventsData) {
    await prisma.event.create({ data: event });
  }
  console.log(`📅 ${eventsData.length} eventos criados`);

  console.log("\n✅ Seed concluído com sucesso!");
  console.log("📧 Login: admin@ebdcomproposito.com");
  console.log("🔑 Senha: admin123\n");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
