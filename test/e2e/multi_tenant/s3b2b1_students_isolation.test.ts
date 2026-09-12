import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const BASE_URL = "http://127.0.0.1:3100";
const TEST_PREFIX = "s3b2b1_st_";

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
    existingCookie.split(";").forEach(pair => {
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
    rawPairs.forEach(pairStr => {
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

  return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function loginAndGetCookie(email: string): Promise<string> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
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
      json: "true"
    }),
    redirect: "manual"
  });

  const loginSetCookie = loginRes.headers.get("set-cookie");
  return mergeCookies(cookieHeader1, loginSetCookie);
}

async function switchOrgInSession(initialCookie: string, orgId: string): Promise<string> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`, {
    headers: { "Cookie": initialCookie }
  });
  const csrfData = await csrfRes.json();
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
      data: { activeOrganizationId: orgId }
    })
  });

  const sessionSetCookie = sessionRes.headers.get("set-cookie");
  return mergeCookies(cookieHeader, sessionSetCookie);
}

describe("S3B.2b1 — Multi-Tenant Students Isolation", () => {
  let orgAId: string;
  let orgBId: string;

  let classAId: string;
  let classBId: string;

  let studentA1Id: string;
  let studentB1Id: string;

  let adminACookie: string;
  let adminAWithOrgCookie: string;
  let viceAdminACookie: string;
  let viceAdminAWithOrgCookie: string;
  let professorACookie: string;
  let professorAWithOrgCookie: string;
  let apoioACookie: string;
  let apoioAWithOrgCookie: string;

  let adminBCookie: string;
  let adminBWithOrgCookie: string;

  let globalAdminCookie: string;
  let globalAdminWithOrgA: string;

  let userNoOrgCookie: string;
  let userInactiveMembershipCookie: string;

  let cleanupAuthorized = false;

  beforeAll(async () => {
    const dbNameResult = await prisma.$queryRaw<Array<{ dbName: string }>>`SELECT DATABASE() as dbName`;
    const currentDb = dbNameResult[0]?.dbName;
    if (currentDb !== "u223033896_ebd_test") {
      throw new Error(`EXECUÇÃO BARRADA: Banco de dados inválido. Esperado u223033896_ebd_test, recebido: ${currentDb}`);
    }

    const initialCounts = await countBusinessTables();
    const nonZeroInitial = initialCounts.filter(c => c.count > 0);
    if (nonZeroInitial.length > 0) {
      const details = nonZeroInitial.map(c => `${c.tableName}: ${c.count}`).join(", ");
      throw new Error(`EXECUÇÃO BARRADA: Banco de testes contém registros preexistentes: ${details}`);
    }

    cleanupAuthorized = true;

    // 1. Criar Organizações
    const orgA = await prisma.organization.create({
      data: { name: `${TEST_PREFIX}Org_A`, slug: `${TEST_PREFIX}org_a_${Date.now()}`, active: true }
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: { name: `${TEST_PREFIX}Org_B`, slug: `${TEST_PREFIX}org_b_${Date.now()}`, active: true }
    });
    orgBId = orgB.id;

    // 2. Criar Usuários e Memberships
    const hashedPassword = await bcrypt.hash("password123", 10);

    const userAdminA = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Admin_A`,
        email: `${TEST_PREFIX}admin_a_${Date.now()}@test.com`,
        password: hashedPassword,
        active: true,
        memberships: {
          create: { organizationId: orgAId, role: "ADMIN", status: "ACTIVE" }
        }
      }
    });

    const userViceAdminA = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}ViceAdmin_A`,
        email: `${TEST_PREFIX}viceadmin_a_${Date.now()}@test.com`,
        password: hashedPassword,
        active: true,
        memberships: {
          create: { organizationId: orgAId, role: "VICE_DIRIGENTE", status: "ACTIVE" }
        }
      }
    });

    const userProfA = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Prof_A`,
        email: `${TEST_PREFIX}prof_a_${Date.now()}@test.com`,
        password: hashedPassword,
        active: true,
        memberships: {
          create: { organizationId: orgAId, role: "PROFESSOR", status: "ACTIVE" }
        }
      }
    });

    const userApoioA = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Apoio_A`,
        email: `${TEST_PREFIX}apoio_a_${Date.now()}@test.com`,
        password: hashedPassword,
        active: true,
        memberships: {
          create: { organizationId: orgAId, role: "APOIO", status: "ACTIVE" }
        }
      }
    });

    const userAdminB = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Admin_B`,
        email: `${TEST_PREFIX}admin_b_${Date.now()}@test.com`,
        password: hashedPassword,
        active: true,
        memberships: {
          create: { organizationId: orgBId, role: "ADMIN", status: "ACTIVE" }
        }
      }
    });

    const userGlobalAdmin = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Global_Admin`,
        email: `${TEST_PREFIX}global_admin_${Date.now()}@test.com`,
        password: hashedPassword,
        active: true,
        isGlobalAdmin: true,
      }
    });

    const userNoOrg = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}User_NoOrg`,
        email: `${TEST_PREFIX}user_noorg_${Date.now()}@test.com`,
        password: hashedPassword,
        active: true,
      }
    });

    const userInactiveMembership = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}User_Inactive`,
        email: `${TEST_PREFIX}user_inactive_${Date.now()}@test.com`,
        password: hashedPassword,
        active: true,
        memberships: {
          create: { organizationId: orgAId, role: "APOIO", status: "INACTIVE" }
        }
      }
    });

    // 3. Criar Turmas
    const classA = await prisma.class.create({
      data: { name: `${TEST_PREFIX}Class_A`, organizationId: orgAId, status: true }
    });
    classAId = classA.id;

    const classB = await prisma.class.create({
      data: { name: `${TEST_PREFIX}Class_B`, organizationId: orgBId, status: true }
    });
    classBId = classB.id;

    // 4. Criar Alunos Iniciais
    const studentA1 = await prisma.student.create({
      data: {
        name: `${TEST_PREFIX}Student_A1`,
        classId: classAId,
        organizationId: orgAId,
        birthDate: new Date("2010-03-15T00:00:00.000Z"),
        active: true
      }
    });
    studentA1Id = studentA1.id;

    const studentB1 = await prisma.student.create({
      data: {
        name: `${TEST_PREFIX}Student_B1`,
        classId: classBId,
        organizationId: orgBId,
        birthDate: new Date("2010-03-20T00:00:00.000Z"),
        active: true
      }
    });
    studentB1Id = studentB1.id;

    // 5. Autenticar e gerar cookies
    adminACookie = await loginAndGetCookie(userAdminA.email);
    adminAWithOrgCookie = await switchOrgInSession(adminACookie, orgAId);

    viceAdminACookie = await loginAndGetCookie(userViceAdminA.email);
    viceAdminAWithOrgCookie = await switchOrgInSession(viceAdminACookie, orgAId);

    professorACookie = await loginAndGetCookie(userProfA.email);
    professorAWithOrgCookie = await switchOrgInSession(professorACookie, orgAId);

    apoioACookie = await loginAndGetCookie(userApoioA.email);
    apoioAWithOrgCookie = await switchOrgInSession(apoioACookie, orgAId);

    adminBCookie = await loginAndGetCookie(userAdminB.email);
    adminBWithOrgCookie = await switchOrgInSession(adminBCookie, orgBId);

    globalAdminCookie = await loginAndGetCookie(userGlobalAdmin.email);
    globalAdminWithOrgA = await switchOrgInSession(globalAdminCookie, orgAId);

    userNoOrgCookie = await loginAndGetCookie(userNoOrg.email);
    userInactiveMembershipCookie = await loginAndGetCookie(userInactiveMembership.email);
  }, 60_000);

  afterAll(async () => {
    if (!cleanupAuthorized) return;

    try {
      await prisma.attendanceItem.deleteMany({
        where: { student: { name: { startsWith: TEST_PREFIX } } }
      });

      await prisma.attendanceRecord.deleteMany({
        where: { class: { name: { startsWith: TEST_PREFIX } } }
      });

      await prisma.absenceJustification.deleteMany({
        where: { student: { name: { startsWith: TEST_PREFIX } } }
      });

      await prisma.studentVisitorPoint.deleteMany({
        where: { student: { name: { startsWith: TEST_PREFIX } } }
      });

      await prisma.quarterHighlight.deleteMany({
        where: { student: { name: { startsWith: TEST_PREFIX } } }
      });

      await prisma.reward.deleteMany({
        where: { student: { name: { startsWith: TEST_PREFIX } } }
      });

      await prisma.visitor.deleteMany({
        where: { organization: { name: { startsWith: TEST_PREFIX } } }
      });

      await prisma.student.deleteMany({
        where: { name: { startsWith: TEST_PREFIX } }
      });

      await prisma.classStaffAssignment.deleteMany({
        where: { class: { name: { startsWith: TEST_PREFIX } } }
      });

      await prisma.class.deleteMany({
        where: { name: { startsWith: TEST_PREFIX } }
      });

      await prisma.organizationMembership.deleteMany({
        where: { organization: { name: { startsWith: TEST_PREFIX } } }
      });

      await prisma.user.deleteMany({
        where: { name: { startsWith: TEST_PREFIX } }
      });

      await prisma.organization.deleteMany({
        where: { name: { startsWith: TEST_PREFIX } }
      });

      const finalCounts = await countBusinessTables();
      const nonZeroFinal = finalCounts.filter(c => c.count > 0);
      if (nonZeroFinal.length > 0) {
        const details = nonZeroFinal.map(c => `${c.tableName}: ${c.count}`).join(", ");
        throw new Error(`TEARDOWN FALHOU: Permanecem registros no banco de testes: ${details}`);
      }
    } finally {
      await prisma.$disconnect();
    }
  }, 60_000);

  // TESTE 1: 401 sem autenticação
  it("1. Rejeita requisições sem autenticação com status 401 nos handlers abrangidos", async () => {
    const resGet = await fetch(`${BASE_URL}/api/students`);
    expect(resGet.status).toBe(401);

    const resPost = await fetch(`${BASE_URL}/api/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unauth", classId: classAId })
    });
    expect(resPost.status).toBe(401);

    const resGetId = await fetch(`${BASE_URL}/api/students/${studentA1Id}`);
    expect(resGetId.status).toBe(401);

    const resPut = await fetch(`${BASE_URL}/api/students/${studentA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Unauth" })
    });
    expect(resPut.status).toBe(401);

    const resDelete = await fetch(`${BASE_URL}/api/students/${studentA1Id}`, {
      method: "DELETE"
    });
    expect(resDelete.status).toBe(401);

    const resBirthdays = await fetch(`${BASE_URL}/api/students/birthdays?month=3`);
    expect(resBirthdays.status).toBe(401);

    const resAttendance = await fetch(`${BASE_URL}/api/attendance?classId=${classAId}&date=2026-03-15`);
    expect(resAttendance.status).toBe(401);
  });

  // TESTE 2: 403 sem organização ativa
  it("2. Rejeita requisições para usuário autenticado sem organização ativa com status 403", async () => {
    const resGet = await fetch(`${BASE_URL}/api/students`, {
      headers: { "Cookie": adminACookie }
    });
    expect(resGet.status).toBe(403);

    const resPost = await fetch(`${BASE_URL}/api/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminACookie },
      body: JSON.stringify({ name: "NoOrg", classId: classAId })
    });
    expect(resPost.status).toBe(403);

    const resPut = await fetch(`${BASE_URL}/api/students/${studentA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminACookie },
      body: JSON.stringify({ name: "Updated NoOrg" })
    });
    expect(resPut.status).toBe(403);

    const resDelete = await fetch(`${BASE_URL}/api/students/${studentA1Id}`, {
      method: "DELETE",
      headers: { "Cookie": adminACookie }
    });
    expect(resDelete.status).toBe(403);
  });

  // TESTE 3: 403 membership inativa
  it("3. Rejeita requisições para usuário com membership inativa com status 403", async () => {
    const inactiveWithOrg = await switchOrgInSession(userInactiveMembershipCookie, orgAId);
    const resGet = await fetch(`${BASE_URL}/api/students`, {
      headers: { "Cookie": inactiveWithOrg }
    });
    expect(resGet.status).toBe(403);
  });

  // TESTE 4: 403 Global Admin sem organização selecionada
  it("4. Global Admin sem organização selecionada recebe status 403", async () => {
    const resGet = await fetch(`${BASE_URL}/api/students`, {
      headers: { "Cookie": globalAdminCookie }
    });
    expect(resGet.status).toBe(403);
  });

  // TESTE 5: Global Admin com organização ativa
  it("5. Global Admin com organização ativa acessa as operações permitidas com status 200/201", async () => {
    const resGet = await fetch(`${BASE_URL}/api/students`, {
      headers: { "Cookie": globalAdminWithOrgA }
    });
    expect(resGet.status).toBe(200);

    const resPost = await fetch(`${BASE_URL}/api/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": globalAdminWithOrgA },
      body: JSON.stringify({ name: `${TEST_PREFIX}Student_CreatedByGlobal`, classId: classAId })
    });
    expect(resPost.status).toBe(201);
  });

  // TESTE 6: GET /api/students isolamento bilateral
  it("6. GET /api/students possui isolamento bilateral estrito entre Org A e Org B", async () => {
    const resA = await fetch(`${BASE_URL}/api/students`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resA.status).toBe(200);
    const dataA = await resA.json();
    expect(dataA.some((s: { id: string }) => s.id === studentA1Id)).toBe(true);
    expect(dataA.some((s: { id: string }) => s.id === studentB1Id)).toBe(false);

    const resB = await fetch(`${BASE_URL}/api/students`, {
      headers: { "Cookie": adminBWithOrgCookie }
    });
    expect(resB.status).toBe(200);
    const dataB = await resB.json();
    expect(dataB.some((s: { id: string }) => s.id === studentB1Id)).toBe(true);
    expect(dataB.some((s: { id: string }) => s.id === studentA1Id)).toBe(false);
  });

  // TESTE 7: GET /api/students/[id] isolamento bilateral
  it("7. GET /api/students/[id] retorna 200 para a própria org e 404 para aluno de outra org", async () => {
    const resOwn = await fetch(`${BASE_URL}/api/students/${studentA1Id}`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resOwn.status).toBe(200);
    const jsonOwn = await resOwn.json();
    expect(jsonOwn.id).toBe(studentA1Id);

    const resCross = await fetch(`${BASE_URL}/api/students/${studentB1Id}`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resCross.status).toBe(404);
  });

  // TESTE 8: GET /api/students/birthdays isolamento bilateral
  it("8. GET /api/students/birthdays possui isolamento bilateral entre Org A e Org B", async () => {
    const resA = await fetch(`${BASE_URL}/api/students/birthdays?month=3`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resA.status).toBe(200);
    const dataA = await resA.json();
    expect(dataA.some((s: { id: string }) => s.id === studentA1Id)).toBe(true);
    expect(dataA.some((s: { id: string }) => s.id === studentB1Id)).toBe(false);
  });

  // TESTE 9: GET /api/attendance retorna apenas alunos da org ativa
  it("9. GET /api/attendance retorna apenas alunos e chamada da organização ativa", async () => {
    const resA = await fetch(`${BASE_URL}/api/attendance?classId=${classAId}&date=2026-03-15`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resA.status).toBe(200);
    const dataA = await resA.json();
    expect(dataA).toHaveProperty("students");
    expect(dataA.students.some((s: { studentId: string }) => s.studentId === studentA1Id)).toBe(true);
    expect(dataA.students.some((s: { studentId: string }) => s.studentId === studentB1Id)).toBe(false);
  });

  // TESTE 10: GET /api/attendance retorna 404 para classId cross-tenant
  it("10. GET /api/attendance retorna 404 para classId pertencente a outra organização", async () => {
    const res = await fetch(`${BASE_URL}/api/attendance?classId=${classBId}&date=2026-03-15`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(res.status).toBe(404);
  });

  // TESTE 11: POST /api/students permitido para ADMIN, DIRIGENTE e VICE_DIRIGENTE
  it("11. POST /api/students é permitido para ADMIN, DIRIGENTE e VICE_DIRIGENTE da organização", async () => {
    const resVice = await fetch(`${BASE_URL}/api/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": viceAdminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Student_CreatedByVice`, classId: classAId })
    });
    expect(resVice.status).toBe(201);
  });

  // TESTE 12: POST /api/students retorna 403 para PROFESSOR e APOIO
  it("12. POST /api/students retorna status 403 para os perfis PROFESSOR e APOIO", async () => {
    const resProf = await fetch(`${BASE_URL}/api/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": professorAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Student_ProfFail`, classId: classAId })
    });
    expect(resProf.status).toBe(403);

    const resApoio = await fetch(`${BASE_URL}/api/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": apoioAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Student_ApoioFail`, classId: classAId })
    });
    expect(resApoio.status).toBe(403);
  });

  // TESTE 13: POST define organizationId no servidor
  it("13. POST /api/students define organizationId exclusivamente pelo servidor na org ativa", async () => {
    const res = await fetch(`${BASE_URL}/api/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Student_AutoOrg`, classId: classAId })
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.organizationId).toBe(orgAId);
  });

  // TESTE 14: POST rejeita injeção de organizationId
  it("14. POST /api/students rejeita tentativas de injeção de organizationId com status 400", async () => {
    const res = await fetch(`${BASE_URL}/api/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Injected`, classId: classAId, organizationId: orgBId })
    });
    expect(res.status).toBe(400);
  });

  // TESTE 15: POST rejeita classId cross-tenant com 404
  it("15. POST /api/students retorna status 404 ao tentar associar turma (classId) da Org B", async () => {
    const res = await fetch(`${BASE_URL}/api/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}CrossClass`, classId: classBId })
    });
    expect(res.status).toBe(404);
  });

  // TESTE 16: POST rejeita body e tipos inválidos
  it("16. POST /api/students rejeita body inválido ou campos obrigatórios ausentes com status 400", async () => {
    const resArray = await fetch(`${BASE_URL}/api/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify([{ name: "Array" }])
    });
    expect(resArray.status).toBe(400);

    const resEmpty = await fetch(`${BASE_URL}/api/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: "   ", classId: classAId })
    });
    expect(resEmpty.status).toBe(400);
  });

  // TESTE 17: PUT permitido para ADMIN, DIRIGENTE e VICE_DIRIGENTE
  it("17. PUT /api/students/[id] é permitido para ADMIN, DIRIGENTE e VICE_DIRIGENTE da organização", async () => {
    const resVice = await fetch(`${BASE_URL}/api/students/${studentA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": viceAdminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Student_A1_UpdatedByVice` })
    });
    expect(resVice.status).toBe(200);
    const json = await resVice.json();
    expect(json.name).toBe(`${TEST_PREFIX}Student_A1_UpdatedByVice`);
  });

  // TESTE 18: PUT retorna 403 para PROFESSOR e APOIO
  it("18. PUT /api/students/[id] retorna status 403 para os perfis PROFESSOR e APOIO", async () => {
    const resProf = await fetch(`${BASE_URL}/api/students/${studentA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": professorAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Student_ProfUpdateFail` })
    });
    expect(resProf.status).toBe(403);

    const resApoio = await fetch(`${BASE_URL}/api/students/${studentA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": apoioAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Student_ApoioUpdateFail` })
    });
    expect(resApoio.status).toBe(403);
  });

  // TESTE 19: PUT permitido para Global Admin com organização ativa
  it("19. PUT /api/students/[id] é permitido para Global Admin com organização ativa", async () => {
    const resGlobal = await fetch(`${BASE_URL}/api/students/${studentA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": globalAdminWithOrgA },
      body: JSON.stringify({ name: `${TEST_PREFIX}Student_A1_UpdatedByGlobal` })
    });
    expect(resGlobal.status).toBe(200);
  });

  // TESTE 20: PUT aluno cross-tenant retorna 404
  it("20. PUT /api/students/[id] retorna status 404 ao tentar atualizar aluno da Org B a partir da Org A", async () => {
    const res = await fetch(`${BASE_URL}/api/students/${studentB1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}HackB` })
    });
    expect(res.status).toBe(404);
  });

  // TESTE 21: PUT classId cross-tenant retorna 404
  it("21. PUT /api/students/[id] retorna status 404 ao tentar associar turma (classId) da Org B", async () => {
    const res = await fetch(`${BASE_URL}/api/students/${studentA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ classId: classBId })
    });
    expect(res.status).toBe(404);
  });

  // TESTE 22: PUT rejeita organizationId e valida tipos
  it("22. PUT /api/students/[id] rejeita organizationId no body, valida tipos e preserva campos omitidos", async () => {
    const resInjected = await fetch(`${BASE_URL}/api/students/${studentA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ organizationId: orgBId })
    });
    expect(resInjected.status).toBe(400);

    const resEmptyName = await fetch(`${BASE_URL}/api/students/${studentA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: "   " })
    });
    expect(resEmptyName.status).toBe(400);
  });

  // TESTE 23: DELETE rejeita perfil insuficiente (403) e recurso cross-tenant (404)
  it("23. DELETE /api/students/[id] retorna status 403 para perfil insuficiente e 404 cross-tenant", async () => {
    const resProf = await fetch(`${BASE_URL}/api/students/${studentA1Id}`, {
      method: "DELETE",
      headers: { "Cookie": professorAWithOrgCookie }
    });
    expect(resProf.status).toBe(403);

    const resCross = await fetch(`${BASE_URL}/api/students/${studentB1Id}`, {
      method: "DELETE",
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resCross.status).toBe(404);
  });

  // TESTE 24: DELETE permitido para gestor e teardown sem resíduos
  it("24. DELETE /api/students/[id] permite exclusão por gestor, retornando 200, com teardown final sem resíduos", async () => {
    const resDelete = await fetch(`${BASE_URL}/api/students/${studentA1Id}`, {
      method: "DELETE",
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resDelete.status).toBe(200);
    const json = await resDelete.json();
    expect(json.success).toBe(true);
  });
});
