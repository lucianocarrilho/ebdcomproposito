import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const BASE_URL = "http://127.0.0.1:3100";
const TEST_PREFIX = "s3b2b2_ld_";

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
      data: { activeOrganizationId: orgId }
    })
  });

  const sessionSetCookie = sessionRes.headers.get("set-cookie");
  return mergeCookies(cookieHeader, sessionSetCookie);
}

describe("S3B.2b2 — Multi-Tenant Leaders, History, and Leader Attendance Isolation", () => {
  let orgAId: string;
  let orgBId: string;

  let classAId: string;
  let classBId: string;

  let leaderA1Id: string;
  let leaderB1Id: string;

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

    // 4. Criar Líderes Iniciais
    const leaderA1 = await prisma.leader.create({
      data: {
        name: `${TEST_PREFIX}Leader_A1`,
        role: "Professor",
        phone: "11999990001",
        email: `${TEST_PREFIX}leader_a1@test.com`,
        classId: classAId,
        startDate: new Date("2026-01-10T00:00:00.000Z"),
        organizationId: orgAId,
        active: true
      }
    });
    leaderA1Id = leaderA1.id;

    const leaderB1 = await prisma.leader.create({
      data: {
        name: `${TEST_PREFIX}Leader_B1`,
        role: "Dirigente",
        phone: "11999990002",
        email: `${TEST_PREFIX}leader_b1@test.com`,
        classId: classBId,
        startDate: new Date("2026-01-10T00:00:00.000Z"),
        organizationId: orgBId,
        active: true
      }
    });
    leaderB1Id = leaderB1.id;

    // 5. Criar Registros Iniciais de Presença de Líderes
    await prisma.leaderAttendance.create({
      data: {
        leaderId: leaderA1Id,
        date: new Date("2026-03-15T00:00:00.000Z"),
        status: "PRESENTE",
        justification: null
      }
    });

    await prisma.leaderAttendance.create({
      data: {
        leaderId: leaderB1Id,
        date: new Date("2026-03-15T00:00:00.000Z"),
        status: "PRESENTE",
        justification: null
      }
    });

    // 6. Autenticar e gerar cookies
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
      await prisma.leaderAttendance.deleteMany({
        where: { leader: { name: { startsWith: TEST_PREFIX } } }
      });

      await prisma.leader.deleteMany({
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
    const resGet = await fetch(`${BASE_URL}/api/leaders`);
    expect(resGet.status).toBe(401);

    const resPost = await fetch(`${BASE_URL}/api/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unauth", role: "Professor" })
    });
    expect(resPost.status).toBe(401);

    const resGetId = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`);
    expect(resGetId.status).toBe(401);

    const resPut = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Unauth" })
    });
    expect(resPut.status).toBe(401);

    const resDelete = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      method: "DELETE"
    });
    expect(resDelete.status).toBe(401);

    const resHistory = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}/history`);
    expect(resHistory.status).toBe(401);

    const resGetAtt = await fetch(`${BASE_URL}/api/attendance/leaders?date=2026-03-15`);
    expect(resGetAtt.status).toBe(401);

    const resPostAtt = await fetch(`${BASE_URL}/api/attendance/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-03-15",
        items: [{ leaderId: leaderA1Id, status: "PRESENTE" }]
      })
    });
    expect(resPostAtt.status).toBe(401);
  });

  // TESTE 2: 403 sem organização ativa
  it("2. Rejeita requisições para usuário autenticado sem organização ativa com status 403", async () => {
    const resGet = await fetch(`${BASE_URL}/api/leaders`, {
      headers: { "Cookie": adminACookie }
    });
    expect(resGet.status).toBe(403);

    const resPost = await fetch(`${BASE_URL}/api/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminACookie },
      body: JSON.stringify({ name: "NoOrg", role: "Professor" })
    });
    expect(resPost.status).toBe(403);

    const resGetId = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      headers: { "Cookie": adminACookie }
    });
    expect(resGetId.status).toBe(403);

    const resPut = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminACookie },
      body: JSON.stringify({ name: "Updated NoOrg" })
    });
    expect(resPut.status).toBe(403);

    const resDelete = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      method: "DELETE",
      headers: { "Cookie": adminACookie }
    });
    expect(resDelete.status).toBe(403);

    const resHistory = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}/history`, {
      headers: { "Cookie": adminACookie }
    });
    expect(resHistory.status).toBe(403);

    const resGetAtt = await fetch(`${BASE_URL}/api/attendance/leaders?date=2026-03-15`, {
      headers: { "Cookie": adminACookie }
    });
    expect(resGetAtt.status).toBe(403);

    const resPostAtt = await fetch(`${BASE_URL}/api/attendance/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminACookie },
      body: JSON.stringify({
        date: "2026-03-15",
        items: [{ leaderId: leaderA1Id, status: "PRESENTE" }]
      })
    });
    expect(resPostAtt.status).toBe(403);
  });

  // TESTE 3: 403 membership inativa
  it("3. Rejeita requisições para usuário com membership inativa com status 403", async () => {
    const inactiveWithOrg = await switchOrgInSession(userInactiveMembershipCookie, orgAId);
    const resGet = await fetch(`${BASE_URL}/api/leaders`, {
      headers: { "Cookie": inactiveWithOrg }
    });
    expect(resGet.status).toBe(403);
  });

  // TESTE 4: 403 Global Admin sem organização selecionada
  it("4. Global Admin sem organização selecionada recebe status 403", async () => {
    const resGet = await fetch(`${BASE_URL}/api/leaders`, {
      headers: { "Cookie": globalAdminCookie }
    });
    expect(resGet.status).toBe(403);
  });

  // TESTE 5: Global Admin com organização ativa
  it("5. Global Admin com organização ativa acessa operações permitidas com status 200/201", async () => {
    const resGet = await fetch(`${BASE_URL}/api/leaders`, {
      headers: { "Cookie": globalAdminWithOrgA }
    });
    expect(resGet.status).toBe(200);

    const resPost = await fetch(`${BASE_URL}/api/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": globalAdminWithOrgA },
      body: JSON.stringify({ name: `${TEST_PREFIX}Leader_CreatedByGlobal`, role: "Dirigente", classId: classAId })
    });
    expect(resPost.status).toBe(201);
  });

  // TESTE 6: GET /api/leaders isolamento bilateral
  it("6. GET /api/leaders possui isolamento bilateral estrito entre Org A e Org B", async () => {
    const resA = await fetch(`${BASE_URL}/api/leaders`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resA.status).toBe(200);
    const dataA = (await resA.json()) as Array<{ id: string }>;
    expect(dataA.some(l => l.id === leaderA1Id)).toBe(true);
    expect(dataA.some(l => l.id === leaderB1Id)).toBe(false);

    const resB = await fetch(`${BASE_URL}/api/leaders`, {
      headers: { "Cookie": adminBWithOrgCookie }
    });
    expect(resB.status).toBe(200);
    const dataB = (await resB.json()) as Array<{ id: string }>;
    expect(dataB.some(l => l.id === leaderB1Id)).toBe(true);
    expect(dataB.some(l => l.id === leaderA1Id)).toBe(false);
  });

  // TESTE 7: GET /api/leaders/[id] próprio (200) e cross-tenant (404)
  it("7. GET /api/leaders/[id] retorna 200 para líder da própria org e 404 para líder de outra org", async () => {
    const resOwn = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resOwn.status).toBe(200);
    const jsonOwn = (await resOwn.json()) as { id: string };
    expect(jsonOwn.id).toBe(leaderA1Id);

    const resCross = await fetch(`${BASE_URL}/api/leaders/${leaderB1Id}`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resCross.status).toBe(404);
  });

  // TESTE 8: GET /api/leaders/[id]/history próprio e cross-tenant
  it("8. GET /api/leaders/[id]/history retorna histórico do líder próprio e 404 cross-tenant", async () => {
    const resOwn = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}/history`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resOwn.status).toBe(200);
    const jsonOwn = (await resOwn.json()) as Array<{ leaderId: string }>;
    expect(Array.isArray(jsonOwn)).toBe(true);
    expect(jsonOwn.some(h => h.leaderId === leaderA1Id)).toBe(true);

    const resCross = await fetch(`${BASE_URL}/api/leaders/${leaderB1Id}/history`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resCross.status).toBe(404);
  });

  // TESTE 9: GET /api/attendance/leaders isolamento bilateral
  it("9. GET /api/attendance/leaders retorna presenças exclusivamente da organização ativa", async () => {
    const resA = await fetch(`${BASE_URL}/api/attendance/leaders?date=2026-03-15`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resA.status).toBe(200);
    const dataA = (await resA.json()) as Array<{ leaderId: string }>;
    expect(dataA.some(item => item.leaderId === leaderA1Id)).toBe(true);
    expect(dataA.some(item => item.leaderId === leaderB1Id)).toBe(false);

    const resB = await fetch(`${BASE_URL}/api/attendance/leaders?date=2026-03-15`, {
      headers: { "Cookie": adminBWithOrgCookie }
    });
    expect(resB.status).toBe(200);
    const dataB = (await resB.json()) as Array<{ leaderId: string }>;
    expect(dataB.some(item => item.leaderId === leaderB1Id)).toBe(true);
    expect(dataB.some(item => item.leaderId === leaderA1Id)).toBe(false);
  });

  // TESTE 10: POST /api/leaders permitido para gestores
  it("10. POST /api/leaders é permitido para ADMIN, DIRIGENTE e VICE_DIRIGENTE da organização", async () => {
    const resVice = await fetch(`${BASE_URL}/api/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": viceAdminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Leader_CreatedByVice`, role: "Vice-Dirigente", classId: classAId })
    });
    expect(resVice.status).toBe(201);
  });

  // TESTE 11: POST /api/leaders retorna 403 para PROFESSOR e APOIO
  it("11. POST /api/leaders retorna status 403 para os perfis PROFESSOR e APOIO", async () => {
    const resProf = await fetch(`${BASE_URL}/api/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": professorAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Leader_ProfFail`, role: "Professor", classId: classAId })
    });
    expect(resProf.status).toBe(403);

    const resApoio = await fetch(`${BASE_URL}/api/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": apoioAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Leader_ApoioFail`, role: "Professor", classId: classAId })
    });
    expect(resApoio.status).toBe(403);
  });

  // TESTE 12: POST /api/leaders define organizationId no servidor
  it("12. POST /api/leaders define organizationId exclusivamente pelo servidor na org ativa", async () => {
    const res = await fetch(`${BASE_URL}/api/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Leader_AutoOrg`, role: "Professor", classId: classAId })
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { organizationId: string };
    expect(json.organizationId).toBe(orgAId);
  });

  // TESTE 13: POST /api/leaders rejeita injeção de organizationId com 400
  it("13. POST /api/leaders rejeita tentativas de injeção de organizationId com status 400", async () => {
    const res = await fetch(`${BASE_URL}/api/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Injected`, role: "Professor", classId: classAId, organizationId: orgBId })
    });
    expect(res.status).toBe(400);
  });

  // TESTE 14: POST /api/leaders retorna 404 para classId cross-tenant
  it("14. POST /api/leaders retorna status 404 ao tentar associar turma (classId) da Org B", async () => {
    const res = await fetch(`${BASE_URL}/api/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}CrossClass`, role: "Professor", classId: classBId })
    });
    expect(res.status).toBe(404);
  });

  // TESTE 15: POST /api/leaders rejeita body e tipos inválidos
  it("15. POST /api/leaders rejeita body inválido, strings vazias ou datas inválidas com status 400", async () => {
    const resArray = await fetch(`${BASE_URL}/api/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify([{ name: "Array", role: "Professor" }])
    });
    expect(resArray.status).toBe(400);

    const resEmpty = await fetch(`${BASE_URL}/api/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: "   ", role: "Professor" })
    });
    expect(resEmpty.status).toBe(400);

    const resInvalidDate = await fetch(`${BASE_URL}/api/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}InvalidDate`, role: "Professor", startDate: "invalid-date-xyz" })
    });
    expect(resInvalidDate.status).toBe(400);
  });

  // TESTE 16: PUT /api/leaders/[id] permitido para gestores
  it("16. PUT /api/leaders/[id] é permitido para ADMIN, DIRIGENTE e VICE_DIRIGENTE da organização", async () => {
    const resVice = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": viceAdminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Leader_A1_UpdatedByVice` })
    });
    expect(resVice.status).toBe(200);
    const json = (await resVice.json()) as { name: string };
    expect(json.name).toBe(`${TEST_PREFIX}Leader_A1_UpdatedByVice`);
  });

  // TESTE 17: PUT /api/leaders/[id] retorna 403 para PROFESSOR e APOIO
  it("17. PUT /api/leaders/[id] retorna status 403 para os perfis PROFESSOR e APOIO", async () => {
    const resProf = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": professorAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Leader_ProfUpdateFail` })
    });
    expect(resProf.status).toBe(403);

    const resApoio = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": apoioAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Leader_ApoioUpdateFail` })
    });
    expect(resApoio.status).toBe(403);
  });

  // TESTE 18: PUT /api/leaders/[id] cross-tenant (404) e classId cross-tenant (404)
  it("18. PUT /api/leaders/[id] retorna status 404 ao tentar atualizar líder da Org B ou vincular classe da Org B", async () => {
    const resCrossLeader = await fetch(`${BASE_URL}/api/leaders/${leaderB1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}HackLeaderB` })
    });
    expect(resCrossLeader.status).toBe(404);

    const resCrossClass = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ classId: classBId })
    });
    expect(resCrossClass.status).toBe(404);
  });

  // TESTE 19: PUT /api/leaders/[id] rejeita organizationId e preserva campos omitidos
  it("19. PUT /api/leaders/[id] rejeita organizationId no body, valida tipos e preserva campos omitidos", async () => {
    const resInjected = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ organizationId: orgBId })
    });
    expect(resInjected.status).toBe(400);

    const resEmptyName = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: "   " })
    });
    expect(resEmptyName.status).toBe(400);

    const resPartial = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ phone: "11988887777" })
    });
    expect(resPartial.status).toBe(200);
    const jsonPartial = (await resPartial.json()) as { phone: string; role: string };
    expect(jsonPartial.phone).toBe("11988887777");
    expect(jsonPartial.role).toBe("Professor");
  });

  // TESTE 20: POST /api/attendance/leaders permissões de gestor e bloqueio de não gestor
  it("20. POST /api/attendance/leaders é permitido para gestor e bloqueado (403) para PROFESSOR e APOIO", async () => {
    const resProf = await fetch(`${BASE_URL}/api/attendance/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": professorAWithOrgCookie },
      body: JSON.stringify({
        date: "2026-03-22",
        items: [{ leaderId: leaderA1Id, status: "PRESENTE" }]
      })
    });
    expect(resProf.status).toBe(403);

    const resApoio = await fetch(`${BASE_URL}/api/attendance/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": apoioAWithOrgCookie },
      body: JSON.stringify({
        date: "2026-03-22",
        items: [{ leaderId: leaderA1Id, status: "PRESENTE" }]
      })
    });
    expect(resApoio.status).toBe(403);

    const resVice = await fetch(`${BASE_URL}/api/attendance/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": viceAdminAWithOrgCookie },
      body: JSON.stringify({
        date: "2026-03-22",
        items: [{ leaderId: leaderA1Id, status: "PRESENTE" }]
      })
    });
    expect(resVice.status).toBe(200);
    const jsonVice = (await resVice.json()) as { success: boolean; saved: number };
    expect(jsonVice.success).toBe(true);
    expect(jsonVice.saved).toBe(1);
  });

  // TESTE 21: POST /api/attendance/leaders rejeita leaderId cross-tenant com 404
  it("21. POST /api/attendance/leaders rejeita payload com leaderId de outra organização com status 404", async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({
        date: "2026-03-22",
        items: [
          { leaderId: leaderA1Id, status: "PRESENTE" },
          { leaderId: leaderB1Id, status: "PRESENTE" }
        ]
      })
    });
    expect(res.status).toBe(404);
  });

  // TESTE 22: POST /api/attendance/leaders preserva chamada de outra organização na mesma data
  it("22. POST /api/attendance/leaders da Org A preserva integralmente presença da Org B na mesma data", async () => {
    const targetDate = "2026-03-29";

    // 1. Org B salva chamada para 2026-03-29
    const resB = await fetch(`${BASE_URL}/api/attendance/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminBWithOrgCookie },
      body: JSON.stringify({
        date: targetDate,
        items: [{ leaderId: leaderB1Id, status: "PRESENTE", justification: "Líder B presente" }]
      })
    });
    expect(resB.status).toBe(200);

    // 2. Org A salva chamada para a MESMA data 2026-03-29
    const resA = await fetch(`${BASE_URL}/api/attendance/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({
        date: targetDate,
        items: [{ leaderId: leaderA1Id, status: "FALTA_JUSTIFICADA", justification: "Viagem ministerial" }]
      })
    });
    expect(resA.status).toBe(200);

    // 3. Verificar que Org B AINDA possui exatamente sua presença gravada
    const resGetB = await fetch(`${BASE_URL}/api/attendance/leaders?date=${targetDate}`, {
      headers: { "Cookie": adminBWithOrgCookie }
    });
    expect(resGetB.status).toBe(200);
    const dataGetB = (await resGetB.json()) as Array<{ leaderId: string; status: string; justification: string | null }>;
    expect(dataGetB.length).toBe(1);
    expect(dataGetB[0].leaderId).toBe(leaderB1Id);
    expect(dataGetB[0].status).toBe("PRESENTE");
    expect(dataGetB[0].justification).toBe("Líder B presente");

    // 4. Verificar que Org A possui sua própria presença gravada
    const resGetA = await fetch(`${BASE_URL}/api/attendance/leaders?date=${targetDate}`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resGetA.status).toBe(200);
    const dataGetA = (await resGetA.json()) as Array<{ leaderId: string; status: string; justification: string | null }>;
    expect(dataGetA.length).toBe(1);
    expect(dataGetA[0].leaderId).toBe(leaderA1Id);
    expect(dataGetA[0].status).toBe("FALTA_JUSTIFICADA");
    expect(dataGetA[0].justification).toBe("Viagem ministerial");
  });

  // TESTE 23: POST /api/attendance/leaders idempotência e rejeição de payloads inválidos (400)
  it("23. POST /api/attendance/leaders é idempotente por data e rejeita payloads e datas inválidos com status 400", async () => {
    // 1. Rejeição de líderes duplicados no mesmo payload
    const resDup = await fetch(`${BASE_URL}/api/attendance/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({
        date: "2026-04-05",
        items: [
          { leaderId: leaderA1Id, status: "PRESENTE" },
          { leaderId: leaderA1Id, status: "FALTA" }
        ]
      })
    });
    expect(resDup.status).toBe(400);

    // 2. Rejeição de data inválida
    const resInvalidDate = await fetch(`${BASE_URL}/api/attendance/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({
        date: "data-invalida",
        items: [{ leaderId: leaderA1Id, status: "PRESENTE" }]
      })
    });
    expect(resInvalidDate.status).toBe(400);

    // 3. Rejeição de items vazio
    const resEmptyItems = await fetch(`${BASE_URL}/api/attendance/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({
        date: "2026-04-05",
        items: []
      })
    });
    expect(resEmptyItems.status).toBe(400);

    // 4. Rejeição de status de presença inválido
    const resInvalidStatus = await fetch(`${BASE_URL}/api/attendance/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({
        date: "2026-04-05",
        items: [{ leaderId: leaderA1Id, status: "STATUS_INVALIDO" }]
      })
    });
    expect(resInvalidStatus.status).toBe(400);

    // 5. Idempotência: salvar duas vezes consecutivas para a mesma data substitui com sucesso
    const resSave1 = await fetch(`${BASE_URL}/api/attendance/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({
        date: "2026-04-05",
        items: [{ leaderId: leaderA1Id, status: "PRESENTE" }]
      })
    });
    expect(resSave1.status).toBe(200);

    const resSave2 = await fetch(`${BASE_URL}/api/attendance/leaders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({
        date: "2026-04-05",
        items: [{ leaderId: leaderA1Id, status: "FALTA" }]
      })
    });
    expect(resSave2.status).toBe(200);

    const resCheck = await fetch(`${BASE_URL}/api/attendance/leaders?date=2026-04-05`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    const checkData = (await resCheck.json()) as Array<{ leaderId: string; status: string }>;
    expect(checkData.length).toBe(1);
    expect(checkData[0].status).toBe("FALTA");
  });

  // TESTE 24: DELETE /api/leaders/[id] permissões, 404 cross-tenant e exclusão atômica de líder com histórico
  it("24. DELETE /api/leaders/[id] bloqueia não gestor (403), cross-tenant (404) e exclui líder com histórico de forma atômica (200)", async () => {
    // 1. Bloqueio para perfil sem permissão (403)
    const resProf = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      method: "DELETE",
      headers: { "Cookie": professorAWithOrgCookie }
    });
    expect(resProf.status).toBe(403);

    // 2. Bloqueio para recurso de outro tenant (404)
    const resCross = await fetch(`${BASE_URL}/api/leaders/${leaderB1Id}`, {
      method: "DELETE",
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resCross.status).toBe(404);

    // 3. Exclusão de líder com presenças vinculadas (deve excluir presenças e líder sem erro de FK)
    const resDelete = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      method: "DELETE",
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resDelete.status).toBe(200);
    const jsonDelete = (await resDelete.json()) as { success: boolean };
    expect(jsonDelete.success).toBe(true);

    // 4. Confirmar que o líder não existe mais
    const resGetDeleted = await fetch(`${BASE_URL}/api/leaders/${leaderA1Id}`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resGetDeleted.status).toBe(404);
  });
});
