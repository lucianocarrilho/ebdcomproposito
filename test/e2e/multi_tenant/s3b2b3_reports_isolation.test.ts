import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const BASE_URL = "http://127.0.0.1:3100";
const TEST_PREFIX = "s3b2b3_rp_";

type DatabaseRow = {
  databaseName: string | null;
};

interface TableCountResult {
  tableName: string;
  count: number;
}

async function countBusinessTables(): Promise<TableCountResult[]> {
  return [
    { tableName: "users", count: await prisma.user.count() },
    { tableName: "classes", count: await prisma.class.count() },
    { tableName: "students", count: await prisma.student.count() },
    { tableName: "leaders", count: await prisma.leader.count() },
    { tableName: "leader_attendance", count: await prisma.leaderAttendance.count() },
    { tableName: "lessons", count: await prisma.lesson.count() },
    { tableName: "attendance_records", count: await prisma.attendanceRecord.count() },
    { tableName: "attendance_items", count: await prisma.attendanceItem.count() },
    { tableName: "absence_justifications", count: await prisma.absenceJustification.count() },
    { tableName: "visitors", count: await prisma.visitor.count() },
    { tableName: "student_visitor_points", count: await prisma.studentVisitorPoint.count() },
    { tableName: "quarter_highlights", count: await prisma.quarterHighlight.count() },
    { tableName: "rewards", count: await prisma.reward.count() },
    { tableName: "events", count: await prisma.event.count() },
    { tableName: "settings", count: await prisma.settings.count() },
    { tableName: "notifications", count: await prisma.notification.count() },
    { tableName: "notification_reads", count: await prisma.notificationRead.count() },
    { tableName: "photo_albums", count: await prisma.photoAlbum.count() },
    { tableName: "photo_items", count: await prisma.photoItem.count() },
    { tableName: "materials", count: await prisma.material.count() },
    { tableName: "organizations", count: await prisma.organization.count() },
    { tableName: "organization_memberships", count: await prisma.organizationMembership.count() },
    { tableName: "class_staff_assignments", count: await prisma.classStaffAssignment.count() },
  ];
}

function mergeCookies(existingCookie: string | null, setCookieHeader: string | null): string {
  const cookieMap = new Map<string, string>();

  if (existingCookie) {
    existingCookie.split(";").forEach((pair) => {
      const trimmed = pair.trim();
      if (!trimmed) return;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const name = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim();
        cookieMap.set(name, value);
      }
    });
  }

  if (setCookieHeader) {
    const rawPairs = setCookieHeader.split(/,(?=\s*[a-zA-Z0-9_%.-]+=)/);
    rawPairs.forEach((pairStr) => {
      const firstPart = pairStr.split(";")[0].trim();
      const eqIdx = firstPart.indexOf("=");
      if (eqIdx > 0) {
        const name = firstPart.substring(0, eqIdx).trim();
        const value = firstPart.substring(eqIdx + 1).trim();
        if (name && !["path", "httponly", "samesite", "domain", "expires", "max-age"].includes(name.toLowerCase())) {
          cookieMap.set(name, value);
        }
      }
    });
  }

  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function loginAndGetCookie(email: string): Promise<string> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfData = (await csrfRes.json()) as { csrfToken: string };
  const csrfToken = csrfData.csrfToken;
  const initialSetCookie = csrfRes.headers.get("set-cookie");
  const cookieHeader1 = mergeCookies(null, initialSetCookie);

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookieHeader1,
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password: "password123",
      json: "true",
    }),
    redirect: "manual",
  });

  const loginSetCookie = loginRes.headers.get("set-cookie");
  return mergeCookies(cookieHeader1, loginSetCookie);
}

async function switchOrgInSession(initialCookie: string, orgId: string): Promise<string> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`, {
    headers: { "Cookie": initialCookie },
  });
  const csrfData = (await csrfRes.json()) as { csrfToken: string };
  const csrfToken = csrfData.csrfToken;
  const csrfSetCookie = csrfRes.headers.get("set-cookie");
  const cookieHeader = mergeCookies(initialCookie, csrfSetCookie);

  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieHeader,
    },
    body: JSON.stringify({
      csrfToken,
      data: { activeOrganizationId: orgId },
    }),
  });

  const sessionSetCookie = sessionRes.headers.get("set-cookie");
  return mergeCookies(cookieHeader, sessionSetCookie);
}

describe("Fase S3B.2b3 — Isolamento Multi-Tenant dos Relatórios", () => {
  let orgAId: string;
  let orgBId: string;

  let globalAdminCookie: string;
  let globalAdminWithOrgACookie: string;
  let orgAAdminCookie: string;
  let orgADirigenteCookie: string;
  let orgAViceDirigenteCookie: string;
  let orgAProfessorCookie: string;
  let orgAApoioCookie: string;
  let orgAInactiveCookie: string;
  let orgBAdminCookie: string;

  let orgAClass1Id: string;
  let orgAClass2Id: string;
  let orgBClass1Id: string;

  let orgAStudent1Id: string;
  let orgAStudent2Id: string;
  let orgBStudent1Id: string;

  let orgALeader1Id: string;
  let orgBLeader1Id: string;

  let cleanupAuthorized = false;

  const testDateStr = "2026-03-15";
  const testDate = new Date("2026-03-15T00:00:00.000Z");

  beforeAll(async () => {
    const databaseRows = await prisma.$queryRaw<DatabaseRow[]>`
      SELECT DATABASE() AS databaseName
    `;
    const databaseName = databaseRows[0]?.databaseName;
    if (databaseName !== "u223033896_ebd_test") {
      throw new Error("Banco de testes não autorizado");
    }

    const initialCounts = await countBusinessTables();
    const nonZeroInitial = initialCounts.filter((c) => c.count > 0);
    if (nonZeroInitial.length > 0) {
      const details = nonZeroInitial.map((c) => `${c.tableName}: ${c.count}`).join(", ");
      throw new Error(`EXECUÇÃO BARRADA: Banco de testes contém registros preexistentes: ${details}`);
    }

    cleanupAuthorized = true;

    const passwordHash = bcrypt.hashSync("password123", 10);

    // 1. Create Organizations
    const orgA = await prisma.organization.create({
      data: {
        name: `${TEST_PREFIX}Org_A`,
        slug: `${TEST_PREFIX}org_a_${Date.now()}`,
        active: true,
      },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: {
        name: `${TEST_PREFIX}Org_B`,
        slug: `${TEST_PREFIX}org_b_${Date.now()}`,
        active: true,
      },
    });
    orgBId = orgB.id;

    // 2. Create Users & Memberships
    const globalAdminUser = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}GlobalAdmin`,
        email: `${TEST_PREFIX}global_admin@test.com`,
        password: passwordHash,
        role: "ADMIN",
        isGlobalAdmin: true,
        active: true,
      },
    });

    const orgAAdminUser = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Admin_A`,
        email: `${TEST_PREFIX}admin_a@test.com`,
        password: passwordHash,
        role: "ADMIN",
        birthDate: new Date("1990-03-20T00:00:00.000Z"),
        active: true,
        memberships: {
          create: {
            organizationId: orgAId,
            role: "ADMIN",
            status: "ACTIVE",
          },
        },
      },
    });

    const orgADirigenteUser = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Dirigente_A`,
        email: `${TEST_PREFIX}dirigente_a@test.com`,
        password: passwordHash,
        role: "DIRIGENTE",
        birthDate: new Date("1985-06-15T00:00:00.000Z"),
        active: true,
        memberships: {
          create: {
            organizationId: orgAId,
            role: "DIRIGENTE",
            status: "ACTIVE",
          },
        },
      },
    });

    const orgAViceDirigenteUser = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Vice_A`,
        email: `${TEST_PREFIX}vice_a@test.com`,
        password: passwordHash,
        role: "VICE_DIRIGENTE",
        birthDate: new Date("1988-04-10T00:00:00.000Z"),
        active: true,
        memberships: {
          create: {
            organizationId: orgAId,
            role: "VICE_DIRIGENTE",
            status: "ACTIVE",
          },
        },
      },
    });

    const orgAProfessorUser = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Prof_A`,
        email: `${TEST_PREFIX}prof_a@test.com`,
        password: passwordHash,
        role: "PROFESSOR",
        active: true,
        memberships: {
          create: {
            organizationId: orgAId,
            role: "PROFESSOR",
            status: "ACTIVE",
          },
        },
      },
    });

    const orgAApoioUser = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Apoio_A`,
        email: `${TEST_PREFIX}apoio_a@test.com`,
        password: passwordHash,
        role: "APOIO",
        active: true,
        memberships: {
          create: {
            organizationId: orgAId,
            role: "APOIO",
            status: "ACTIVE",
          },
        },
      },
    });

    const orgAInactiveUser = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Inativo_A`,
        email: `${TEST_PREFIX}inativo_a@test.com`,
        password: passwordHash,
        role: "ADMIN",
        active: true,
        memberships: {
          create: {
            organizationId: orgAId,
            role: "ADMIN",
            status: "INACTIVE",
          },
        },
      },
    });

    const orgBAdminUser = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Admin_B`,
        email: `${TEST_PREFIX}admin_b@test.com`,
        password: passwordHash,
        role: "ADMIN",
        birthDate: new Date("1992-03-25T00:00:00.000Z"),
        active: true,
        memberships: {
          create: {
            organizationId: orgBId,
            role: "ADMIN",
            status: "ACTIVE",
          },
        },
      },
    });

    // 3. Create Classes
    const classA1 = await prisma.class.create({
      data: {
        name: `${TEST_PREFIX}Adultos Org A`,
        organizationId: orgAId,
        status: true,
      },
    });
    orgAClass1Id = classA1.id;

    const classA2 = await prisma.class.create({
      data: {
        name: `${TEST_PREFIX}Jovens Org A`,
        organizationId: orgAId,
        status: true,
      },
    });
    orgAClass2Id = classA2.id;

    const classB1 = await prisma.class.create({
      data: {
        name: `${TEST_PREFIX}Adultos Org B`,
        organizationId: orgBId,
        status: true,
      },
    });
    orgBClass1Id = classB1.id;

    // 4. Create Students
    const studentA1 = await prisma.student.create({
      data: {
        name: `${TEST_PREFIX}Aluno A1`,
        classId: orgAClass1Id,
        organizationId: orgAId,
        birthDate: new Date("2000-03-10T00:00:00.000Z"),
        active: true,
      },
    });
    orgAStudent1Id = studentA1.id;

    const studentA2 = await prisma.student.create({
      data: {
        name: `${TEST_PREFIX}Aluno A2`,
        classId: orgAClass2Id,
        organizationId: orgAId,
        birthDate: new Date("2002-08-15T00:00:00.000Z"),
        active: true,
      },
    });
    orgAStudent2Id = studentA2.id;

    const studentB1 = await prisma.student.create({
      data: {
        name: `${TEST_PREFIX}Aluno B1`,
        classId: orgBClass1Id,
        organizationId: orgBId,
        birthDate: new Date("1995-03-12T00:00:00.000Z"),
        active: true,
      },
    });
    orgBStudent1Id = studentB1.id;

    // 5. Create Leaders
    const leaderA = await prisma.leader.create({
      data: {
        name: `${TEST_PREFIX}Líder Org A`,
        role: "Superintendente",
        organizationId: orgAId,
        classId: orgAClass1Id,
        active: true,
      },
    });
    orgALeader1Id = leaderA.id;

    const leaderB = await prisma.leader.create({
      data: {
        name: `${TEST_PREFIX}Líder Org B`,
        role: "Dirigente",
        organizationId: orgBId,
        classId: orgBClass1Id,
        active: true,
      },
    });
    orgBLeader1Id = leaderB.id;

    // 6. Create Leader Attendance
    await prisma.leaderAttendance.create({
      data: {
        leaderId: orgALeader1Id,
        date: testDate,
        status: "PRESENTE",
      },
    });

    await prisma.leaderAttendance.create({
      data: {
        leaderId: orgBLeader1Id,
        date: testDate,
        status: "FALTA",
      },
    });

    // 7. Create Attendance Records & Items
    await prisma.attendanceRecord.create({
      data: {
        date: testDate,
        classId: orgAClass1Id,
        organizationId: orgAId,
        biblias: 10,
        revistas: 8,
        ofertas: 150.5,
        outros: 2,
        items: {
          create: {
            studentId: orgAStudent1Id,
            status: "PRESENTE",
          },
        },
      },
    });

    await prisma.attendanceRecord.create({
      data: {
        date: testDate,
        classId: orgAClass2Id,
        organizationId: orgAId,
        biblias: 5,
        revistas: 4,
        ofertas: 50.0,
        outros: 1,
        items: {
          create: {
            studentId: orgAStudent2Id,
            status: "FALTA",
          },
        },
      },
    });

    await prisma.attendanceRecord.create({
      data: {
        date: testDate,
        classId: orgBClass1Id,
        organizationId: orgBId,
        biblias: 20,
        revistas: 15,
        ofertas: 300.0,
        outros: 5,
        items: {
          create: {
            studentId: orgBStudent1Id,
            status: "PRESENTE",
          },
        },
      },
    });

    // 8. Create Visitors
    await prisma.visitor.create({
      data: {
        name: `${TEST_PREFIX}Visitante Org A`,
        classId: orgAClass1Id,
        organizationId: orgAId,
        date: testDate,
        invitedById: orgAStudent1Id,
        observations: "Convidado por Aluno A1",
      },
    });

    await prisma.visitor.create({
      data: {
        name: `${TEST_PREFIX}Visitante Org B`,
        classId: orgBClass1Id,
        organizationId: orgBId,
        date: testDate,
        invitedById: orgBStudent1Id,
        observations: "Convidado por Aluno B1",
      },
    });

    // 9. Login all users & generate cookies
    globalAdminCookie = await loginAndGetCookie(globalAdminUser.email);
    globalAdminWithOrgACookie = await switchOrgInSession(globalAdminCookie, orgAId);

    const rawOrgAAdminCookie = await loginAndGetCookie(orgAAdminUser.email);
    orgAAdminCookie = await switchOrgInSession(rawOrgAAdminCookie, orgAId);

    const rawOrgADirigenteCookie = await loginAndGetCookie(orgADirigenteUser.email);
    orgADirigenteCookie = await switchOrgInSession(rawOrgADirigenteCookie, orgAId);

    const rawOrgAViceDirigenteCookie = await loginAndGetCookie(orgAViceDirigenteUser.email);
    orgAViceDirigenteCookie = await switchOrgInSession(rawOrgAViceDirigenteCookie, orgAId);

    const rawOrgAProfessorCookie = await loginAndGetCookie(orgAProfessorUser.email);
    orgAProfessorCookie = await switchOrgInSession(rawOrgAProfessorCookie, orgAId);

    const rawOrgAApoioCookie = await loginAndGetCookie(orgAApoioUser.email);
    orgAApoioCookie = await switchOrgInSession(rawOrgAApoioCookie, orgAId);

    const rawOrgAInactiveCookie = await loginAndGetCookie(orgAInactiveUser.email);
    orgAInactiveCookie = await switchOrgInSession(rawOrgAInactiveCookie, orgAId);

    const rawOrgBAdminCookie = await loginAndGetCookie(orgBAdminUser.email);
    orgBAdminCookie = await switchOrgInSession(rawOrgBAdminCookie, orgBId);
  }, 60_000);

  afterAll(async () => {
    try {
      if (!cleanupAuthorized) return;

      await prisma.leaderAttendance.deleteMany({
        where: { leader: { name: { startsWith: TEST_PREFIX } } },
      });

      await prisma.attendanceItem.deleteMany({
        where: { student: { name: { startsWith: TEST_PREFIX } } },
      });

      await prisma.attendanceRecord.deleteMany({
        where: { class: { name: { startsWith: TEST_PREFIX } } },
      });

      await prisma.visitor.deleteMany({
        where: { name: { startsWith: TEST_PREFIX } },
      });

      await prisma.student.deleteMany({
        where: { name: { startsWith: TEST_PREFIX } },
      });

      await prisma.leader.deleteMany({
        where: { name: { startsWith: TEST_PREFIX } },
      });

      await prisma.classStaffAssignment.deleteMany({
        where: { class: { name: { startsWith: TEST_PREFIX } } },
      });

      await prisma.class.deleteMany({
        where: { name: { startsWith: TEST_PREFIX } },
      });

      await prisma.organizationMembership.deleteMany({
        where: { organization: { name: { startsWith: TEST_PREFIX } } },
      });

      await prisma.user.deleteMany({
        where: { name: { startsWith: TEST_PREFIX } },
      });

      await prisma.organization.deleteMany({
        where: { name: { startsWith: TEST_PREFIX } },
      });

      const finalCounts = await countBusinessTables();
      const nonZeroFinal = finalCounts.filter((c) => c.count > 0);
      if (nonZeroFinal.length > 0) {
        const details = nonZeroFinal.map((c) => `${c.tableName}: ${c.count}`).join(", ");
        throw new Error(`TEARDOWN FALHOU: Permanecem registros no banco de testes: ${details}`);
      }
    } finally {
      await prisma.$disconnect();
    }
  }, 60_000);

  // --- GRUPO 1: AUTENTICAÇÃO E AUTORIZAÇÃO (TESTES 1 A 10) ---

  it("1. GET /api/reports retorna 401 para requisicao nao autenticada", async () => {
    const res = await fetch(`${BASE_URL}/api/reports`);
    expect(res.status).toBe(401);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Não autorizado");
  });

  it("2. GET /api/reports/daily retorna 401 para requisicao nao autenticada", async () => {
    const res = await fetch(`${BASE_URL}/api/reports/daily`);
    expect(res.status).toBe(401);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Não autorizado");
  });

  it("3. GET /api/reports retorna 403 quando sessao nao tem activeOrganizationId", async () => {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      headers: { "Cookie": globalAdminCookie },
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Organização não selecionada");
  });

  it("4. GET /api/reports/daily retorna 403 quando sessao nao tem activeOrganizationId", async () => {
    const res = await fetch(`${BASE_URL}/api/reports/daily`, {
      headers: { "Cookie": globalAdminCookie },
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Organização não selecionada");
  });

  it("5. GET /api/reports e /api/reports/daily retornam 403 para usuario com membership INACTIVE", async () => {
    const resReports = await fetch(`${BASE_URL}/api/reports`, {
      headers: { "Cookie": orgAInactiveCookie },
    });
    expect(resReports.status).toBe(403);
    const dataReports = (await resReports.json()) as { error: string };
    expect(dataReports.error).toBe("Organização não selecionada");

    const resDaily = await fetch(`${BASE_URL}/api/reports/daily?date=${testDateStr}`, {
      headers: { "Cookie": orgAInactiveCookie },
    });
    expect(resDaily.status).toBe(403);
    const dataDaily = (await resDaily.json()) as { error: string };
    expect(dataDaily.error).toBe("Organização não selecionada");
  });

  it("6. GET /api/reports retorna 403 para role PROFESSOR (politica somente gestores)", async () => {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      headers: { "Cookie": orgAProfessorCookie },
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Permissão insuficiente");
  });

  it("7. GET /api/reports retorna 403 para role APOIO (politica somente gestores)", async () => {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      headers: { "Cookie": orgAApoioCookie },
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Permissão insuficiente");
  });

  it("8. GET /api/reports/daily retorna 403 para role PROFESSOR (politica somente gestores)", async () => {
    const res = await fetch(`${BASE_URL}/api/reports/daily?date=${testDateStr}`, {
      headers: { "Cookie": orgAProfessorCookie },
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Permissão insuficiente");
  });

  it("9. GET /api/reports/daily retorna 403 para role APOIO (politica somente gestores)", async () => {
    const res = await fetch(`${BASE_URL}/api/reports/daily?date=${testDateStr}`, {
      headers: { "Cookie": orgAApoioCookie },
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Permissão insuficiente");
  });

  it("10. GET /api/reports retorna 200 para Global Admin com organizacao ativa", async () => {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      headers: { "Cookie": globalAdminWithOrgACookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { summary: { totalStudents: number }; classData: { id: string }[] };
    expect(data.summary.totalStudents).toBe(2);
    expect(data.classData.length).toBe(2);
  });

  // --- GRUPO 2: ISOLAMENTO MULTI-TENANT EM /api/reports (TESTES 11 A 19) ---

  it("11. GET /api/reports?type=classe: Gestor da Org A visualiza apenas classes e ofertas da Org A", async () => {
    const res = await fetch(`${BASE_URL}/api/reports?type=classe&startDate=2026-01-01&endDate=2026-12-31`, {
      headers: { "Cookie": orgAAdminCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      summary: {
        totalStudents: number;
        generalFreq: number;
        totalFaltas: number;
        totalBiblias: number;
        totalRevistas: number;
        totalOfertas: number;
        totalOutros: number;
      };
      classData: { id: string; classe: string; matriculados: number; ofertas: number }[];
    };

    expect(data.summary.totalStudents).toBe(2);
    expect(data.summary.totalBiblias).toBe(15);
    expect(data.summary.totalRevistas).toBe(12);
    expect(data.summary.totalOfertas).toBe(200.5); // 150.50 + 50.00 (Org B 300.00 NAO entra)
    expect(data.summary.totalOutros).toBe(3);

    const classNames = data.classData.map((c) => c.classe);
    expect(classNames).toContain(`${TEST_PREFIX}Adultos Org A`);
    expect(classNames).toContain(`${TEST_PREFIX}Jovens Org A`);
    expect(classNames).not.toContain(`${TEST_PREFIX}Adultos Org B`);
  });

  it("12. GET /api/reports?type=classe&classId=...: Gestor da Org A com classId valido retorna apenas essa classe", async () => {
    const res = await fetch(`${BASE_URL}/api/reports?type=classe&classId=${orgAClass1Id}&startDate=2026-01-01&endDate=2026-12-31`, {
      headers: { "Cookie": orgADirigenteCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      summary: { totalStudents: number; totalOfertas: number };
      classData: { id: string; classe: string; ofertas: number }[];
    };
    expect(data.classData.length).toBe(1);
    expect(data.classData[0].id).toBe(orgAClass1Id);
    expect(data.classData[0].classe).toBe(`${TEST_PREFIX}Adultos Org A`);
    expect(data.summary.totalOfertas).toBe(150.5);
  });

  it("13. GET /api/reports?type=classe&classId=...: Gestor da Org A com classId da Org B responde 404", async () => {
    const res = await fetch(`${BASE_URL}/api/reports?type=classe&classId=${orgBClass1Id}&startDate=2026-01-01&endDate=2026-12-31`, {
      headers: { "Cookie": orgAAdminCookie },
    });
    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Classe não encontrada");
  });

  it("14. GET /api/reports?type=aluno: Gestor da Org A visualiza frequencia exclusivamente dos alunos da Org A", async () => {
    const res = await fetch(`${BASE_URL}/api/reports?type=aluno&startDate=2026-01-01&endDate=2026-12-31`, {
      headers: { "Cookie": orgAAdminCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      students: { id: string; name: string; classe: string; freq: number; presencas: number; faltas: number }[];
    };
    const studentNames = data.students.map((s) => s.name);
    expect(studentNames).toContain(`${TEST_PREFIX}Aluno A1`);
    expect(studentNames).toContain(`${TEST_PREFIX}Aluno A2`);
    expect(studentNames).not.toContain(`${TEST_PREFIX}Aluno B1`);

    const a1 = data.students.find((s) => s.id === orgAStudent1Id);
    expect(a1?.presencas).toBe(1);
    expect(a1?.faltas).toBe(0);
    expect(a1?.freq).toBe(100);

    const a2 = data.students.find((s) => s.id === orgAStudent2Id);
    expect(a2?.presencas).toBe(0);
    expect(a2?.faltas).toBe(1);
    expect(a2?.freq).toBe(0);
  });

  it("15. GET /api/reports?type=visitantes: Gestor da Org A visualiza apenas visitantes da Org A", async () => {
    const res = await fetch(`${BASE_URL}/api/reports?type=visitantes&startDate=2026-01-01&endDate=2026-12-31`, {
      headers: { "Cookie": orgAAdminCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      visitantes: { id: string; name: string; classe: string; convidadoPor: string }[];
    };
    const names = data.visitantes.map((v) => v.name);
    expect(names).toContain(`${TEST_PREFIX}Visitante Org A`);
    expect(names).not.toContain(`${TEST_PREFIX}Visitante Org B`);

    const vA = data.visitantes.find((v) => v.name === `${TEST_PREFIX}Visitante Org A`);
    expect(vA?.classe).toBe(`${TEST_PREFIX}Adultos Org A`);
    expect(vA?.convidadoPor).toBe(`${TEST_PREFIX}Aluno A1`);
  });

  it("16. GET /api/reports?type=lideranca: Gestor da Org A visualiza apenas lideres e metricas da Org A", async () => {
    const res = await fetch(`${BASE_URL}/api/reports?type=lideranca&startDate=2026-01-01&endDate=2026-12-31`, {
      headers: { "Cookie": orgAAdminCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      summary: { totalLeaders: number; generalFreq: number; totalFaltas: number };
      leaders: { id: string; name: string; role: string; freq: number }[];
    };
    expect(data.summary.totalLeaders).toBe(1);
    expect(data.summary.generalFreq).toBe(100);
    expect(data.summary.totalFaltas).toBe(0);

    const leaderNames = data.leaders.map((l) => l.name);
    expect(leaderNames).toContain(`${TEST_PREFIX}Líder Org A`);
    expect(leaderNames).not.toContain(`${TEST_PREFIX}Líder Org B`);
  });

  it("17. GET /api/reports?type=aniversariantes: Gestor da Org A visualiza aniversariantes de alunos e equipe da Org A", async () => {
    const res = await fetch(`${BASE_URL}/api/reports?type=aniversariantes&startDate=2026-03-01&endDate=2026-03-31`, {
      headers: { "Cookie": orgAAdminCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      aniversariantes: { id: string; name: string; classe: string }[];
    };
    const names = data.aniversariantes.map((a) => a.name);
    expect(names).toContain(`${TEST_PREFIX}Aluno A1`);
    expect(names).toContain(`${TEST_PREFIX}Admin_A`);
    expect(names).not.toContain(`${TEST_PREFIX}Aluno B1`);
    expect(names).not.toContain(`${TEST_PREFIX}Admin_B`);
  });

  it("18. GET /api/reports?type=trimestre: Gestores DIRIGENTE e VICE_DIRIGENTE recebem resumo trimestral isolado da Org A", async () => {
    const resDir = await fetch(`${BASE_URL}/api/reports?type=trimestre&startDate=2026-01-01&endDate=2026-03-31`, {
      headers: { "Cookie": orgADirigenteCookie },
    });
    expect(resDir.status).toBe(200);
    const dataDir = (await resDir.json()) as {
      summary: { totalStudents: number; totalOfertas: number };
      classData: { id: string; classe: string }[];
    };
    expect(dataDir.summary.totalStudents).toBe(2);
    expect(dataDir.summary.totalOfertas).toBe(200.5);
    expect(dataDir.classData.length).toBe(2);

    const resVice = await fetch(`${BASE_URL}/api/reports?type=trimestre&startDate=2026-01-01&endDate=2026-03-31`, {
      headers: { "Cookie": orgAViceDirigenteCookie },
    });
    expect(resVice.status).toBe(200);
    const dataVice = (await resVice.json()) as {
      summary: { totalStudents: number; totalOfertas: number };
      classData: { id: string; classe: string }[];
    };
    expect(dataVice.summary.totalStudents).toBe(2);
    expect(dataVice.summary.totalOfertas).toBe(200.5);
    expect(dataVice.classData.length).toBe(2);
  });

  it("19. GET /api/reports?type=premiados: Gestor da Org A recebe relatorio de destaques isolado da Org A", async () => {
    const res = await fetch(`${BASE_URL}/api/reports?type=premiados&startDate=2026-01-01&endDate=2026-03-31`, {
      headers: { "Cookie": orgAAdminCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      summary: { totalStudents: number; totalOfertas: number };
      classData: { id: string; classe: string }[];
    };
    expect(data.summary.totalStudents).toBe(2);
    expect(data.classData.length).toBe(2);
  });

  // --- GRUPO 3: ISOLAMENTO EM /api/reports/daily (MAPA DO DIA) (TESTES 20 A 24) ---

  it("20. GET /api/reports/daily: Gestor da Org A visualiza mapa do dia com resumo, classes e ofertas exclusivas da Org A", async () => {
    const res = await fetch(`${BASE_URL}/api/reports/daily?date=${testDateStr}`, {
      headers: { "Cookie": orgAAdminCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      date: string;
      summary: {
        totalEnrolled: number;
        totalPresent: number;
        totalAbsent: number;
        totalVisitors: number;
        totalBiblias: number;
        totalRevistas: number;
        totalOfertas: number;
        totalOutros: number;
        schoolFreq: number;
      };
      classes: { id: string; className: string; enrolled: number; present: number; absent: number; ofertas: number }[];
      leaders: { enrolled: number; present: number; absent: number; freq: number };
    };

    expect(data.date).toBe(testDateStr);
    expect(data.summary.totalEnrolled).toBe(2);
    expect(data.summary.totalPresent).toBe(1);
    expect(data.summary.totalAbsent).toBe(1);
    expect(data.summary.totalVisitors).toBe(1);
    expect(data.summary.totalBiblias).toBe(15);
    expect(data.summary.totalRevistas).toBe(12);
    expect(data.summary.totalOfertas).toBe(200.5); // 150.50 + 50.00 (Org B 300.00 isolada)
    expect(data.summary.totalOutros).toBe(3);
    expect(data.summary.schoolFreq).toBe(50);

    const classNames = data.classes.map((c) => c.className);
    expect(classNames).toContain(`${TEST_PREFIX}Adultos Org A`);
    expect(classNames).toContain(`${TEST_PREFIX}Jovens Org A`);
    expect(classNames).not.toContain(`${TEST_PREFIX}Adultos Org B`);
  });

  it("21. GET /api/reports/daily: Gestores DIRIGENTE e VICE_DIRIGENTE visualizam presenca da lideranca restrita aos lideres da Org A", async () => {
    const resDir = await fetch(`${BASE_URL}/api/reports/daily?date=${testDateStr}`, {
      headers: { "Cookie": orgADirigenteCookie },
    });
    expect(resDir.status).toBe(200);
    const dataDir = (await resDir.json()) as {
      leaders: { enrolled: number; present: number; absent: number; justified: number; freq: number };
    };
    expect(dataDir.leaders.enrolled).toBe(1);
    expect(dataDir.leaders.present).toBe(1);
    expect(dataDir.leaders.absent).toBe(0);
    expect(dataDir.leaders.justified).toBe(0);
    expect(dataDir.leaders.freq).toBe(100);

    const resVice = await fetch(`${BASE_URL}/api/reports/daily?date=${testDateStr}`, {
      headers: { "Cookie": orgAViceDirigenteCookie },
    });
    expect(resVice.status).toBe(200);
    const dataVice = (await resVice.json()) as {
      leaders: { enrolled: number; present: number; absent: number; justified: number; freq: number };
    };
    expect(dataVice.leaders.enrolled).toBe(1);
    expect(dataVice.leaders.present).toBe(1);
    expect(dataVice.leaders.absent).toBe(0);
    expect(dataVice.leaders.justified).toBe(0);
    expect(dataVice.leaders.freq).toBe(100);
  });

  it("22. GET /api/reports/daily: Gestor da Org B na mesma data visualiza exclusivamente dados da Org B", async () => {
    const res = await fetch(`${BASE_URL}/api/reports/daily?date=${testDateStr}`, {
      headers: { "Cookie": orgBAdminCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      date: string;
      summary: {
        totalEnrolled: number;
        totalPresent: number;
        totalAbsent: number;
        totalVisitors: number;
        totalBiblias: number;
        totalRevistas: number;
        totalOfertas: number;
        totalOutros: number;
        schoolFreq: number;
      };
      classes: { id: string; className: string; enrolled: number; present: number; ofertas: number }[];
      leaders: { enrolled: number; present: number; absent: number; freq: number };
    };

    expect(data.summary.totalEnrolled).toBe(1);
    expect(data.summary.totalPresent).toBe(1);
    expect(data.summary.totalAbsent).toBe(0);
    expect(data.summary.totalVisitors).toBe(1);
    expect(data.summary.totalBiblias).toBe(20);
    expect(data.summary.totalRevistas).toBe(15);
    expect(data.summary.totalOfertas).toBe(300.0);
    expect(data.summary.totalOutros).toBe(5);
    expect(data.summary.schoolFreq).toBe(100);

    const classNames = data.classes.map((c) => c.className);
    expect(classNames).toEqual([`${TEST_PREFIX}Adultos Org B`]);

    expect(data.leaders.enrolled).toBe(1);
    expect(data.leaders.present).toBe(0);
    expect(data.leaders.absent).toBe(1);
    expect(data.leaders.freq).toBe(0);
  });

  it("23. GET /api/reports/daily em data sem registros retorna mapa zerado com classes da organizacao ativa", async () => {
    const res = await fetch(`${BASE_URL}/api/reports/daily?date=2026-03-22`, {
      headers: { "Cookie": orgAAdminCookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      date: string;
      summary: { totalEnrolled: number; totalPresent: number; totalOfertas: number; schoolFreq: number };
      classes: { id: string; className: string; enrolled: number; present: number; ofertas: number }[];
      leaders: { enrolled: number; present: number; absent: number; freq: number };
    };

    expect(data.date).toBe("2026-03-22");
    expect(data.summary.totalEnrolled).toBe(2);
    expect(data.summary.totalPresent).toBe(0);
    expect(data.summary.totalOfertas).toBe(0);
    expect(data.summary.schoolFreq).toBe(0);
    expect(data.classes.length).toBe(2);
    expect(data.leaders.enrolled).toBe(1);
    expect(data.leaders.present).toBe(0);
  });

  it("24. GET /api/reports/daily retorna 200 para Global Admin com organizacao ativa", async () => {
    const res = await fetch(`${BASE_URL}/api/reports/daily?date=${testDateStr}`, {
      headers: { "Cookie": globalAdminWithOrgACookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      summary: { totalEnrolled: number; totalOfertas: number };
      classes: { id: string; className: string }[];
    };
    expect(data.summary.totalEnrolled).toBe(2);
    expect(data.summary.totalOfertas).toBe(200.5);
    expect(data.classes.length).toBe(2);
  });
});
