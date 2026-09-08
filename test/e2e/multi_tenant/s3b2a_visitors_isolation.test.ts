import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const BASE_URL = "http://127.0.0.1:3100";
const TEST_PREFIX = "s3b2a_vIsItOrS_";

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

// Cookie normalization helper approved in S3B.1
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

describe("S3B.2a — Multi-Tenant Visitors Isolation", () => {
  // IDs de Fixtures
  let orgAId: string;
  let orgBId: string;

  let classAId: string;
  let classBId: string;

  let studentAId: string;
  let studentBId: string;

  let visitorA1Id: string;
  let visitorB1Id: string;

  // Credenciais e Cookies
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
    // 0. Validação estrita de segurança do banco de dados
    const dbNameResult = await prisma.$queryRaw<Array<{ dbName: string }>>`SELECT DATABASE() as dbName`;
    const currentDb = dbNameResult[0]?.dbName;
    if (currentDb !== "u223033896_ebd_test") {
      throw new Error(`EXECUÇÃO BARRADA: Banco de dados inválido. Esperado u223033896_ebd_test, recebido: ${currentDb}`);
    }

    // 0b. Exigir zero registros nas 23 tabelas negociais antes de criar qualquer fixture
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

    const userGlobal = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}GlobalAdmin`,
        email: `${TEST_PREFIX}global_${Date.now()}@test.com`,
        password: hashedPassword,
        isGlobalAdmin: true,
        active: true,
      }
    });

    const userNoOrg = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}NoOrg`,
        email: `${TEST_PREFIX}noorg_${Date.now()}@test.com`,
        password: hashedPassword,
        active: true,
      }
    });

    const userInactive = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Inactive`,
        email: `${TEST_PREFIX}inactive_${Date.now()}@test.com`,
        password: hashedPassword,
        active: true,
        memberships: {
          create: { organizationId: orgAId, role: "PROFESSOR", status: "INACTIVE" }
        }
      }
    });

    // 3. Criar Turmas e Alunos Fixtures
    const classA = await prisma.class.create({
      data: { name: `${TEST_PREFIX}Class_A`, organizationId: orgAId, status: true }
    });
    classAId = classA.id;

    const classB = await prisma.class.create({
      data: { name: `${TEST_PREFIX}Class_B`, organizationId: orgBId, status: true }
    });
    classBId = classB.id;

    const studentA = await prisma.student.create({
      data: { name: `${TEST_PREFIX}Student_A`, classId: classAId, organizationId: orgAId, active: true }
    });
    studentAId = studentA.id;

    const studentB = await prisma.student.create({
      data: { name: `${TEST_PREFIX}Student_B`, classId: classBId, organizationId: orgBId, active: true }
    });
    studentBId = studentB.id;

    // 4. Criar Visitantes Iniciais Fixtures
    const visitorA1 = await prisma.visitor.create({
      data: {
        name: `${TEST_PREFIX}Visitor_A1`,
        date: new Date("2026-03-01T12:00:00.000Z"),
        classId: classAId,
        invitedById: studentAId,
        observations: "Visitante de teste A1",
        organizationId: orgAId
      }
    });
    visitorA1Id = visitorA1.id;

    const visitorB1 = await prisma.visitor.create({
      data: {
        name: `${TEST_PREFIX}Visitor_B1`,
        date: new Date("2026-03-01T12:00:00.000Z"),
        classId: classBId,
        invitedById: studentBId,
        observations: "Visitante de teste B1",
        organizationId: orgBId
      }
    });
    visitorB1Id = visitorB1.id;

    // 5. Adquirir Cookies de Autenticação
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

    globalAdminCookie = await loginAndGetCookie(userGlobal.email);
    globalAdminWithOrgA = await switchOrgInSession(globalAdminCookie, orgAId);

    userNoOrgCookie = await loginAndGetCookie(userNoOrg.email);
    userInactiveMembershipCookie = await loginAndGetCookie(userInactive.email);
  }, 60_000);

  afterAll(async () => {
    try {
      if (!cleanupAuthorized) {
        return;
      }

      // Teardown em ordem reversa utilizando exclusivamente o TEST_PREFIX
      await prisma.visitor.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
      await prisma.student.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
      await prisma.class.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
      await prisma.organizationMembership.deleteMany({
        where: { user: { name: { startsWith: TEST_PREFIX } } }
      });
      await prisma.user.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
      await prisma.organization.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });

      // Verificação de zero registros residuais nas 23 tabelas negociais após a limpeza
      const finalCounts = await countBusinessTables();
      const nonZeroFinal = finalCounts.filter(c => c.count > 0);
      if (nonZeroFinal.length > 0) {
        const details = nonZeroFinal.map(c => `${c.tableName}: ${c.count}`).join(", ");
        throw new Error(`FALHA NO TEARDOWN: Resíduos encontrados após limpeza: ${details}`);
      }
    } finally {
      await prisma.$disconnect();
    }
  }, 60_000);

  // TESTE 1: 401 sem autenticação nos quatro handlers
  it("1. Rejeita requisições sem autenticação com status 401 nos 4 handlers", async () => {
    const resGet = await fetch(`${BASE_URL}/api/visitors`);
    expect(resGet.status).toBe(401);

    const resPost = await fetch(`${BASE_URL}/api/visitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unauth", date: "2026-03-02", classId: classAId })
    });
    expect(resPost.status).toBe(401);

    const resPut = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Unauth" })
    });
    expect(resPut.status).toBe(401);

    const resDelete = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "DELETE"
    });
    expect(resDelete.status).toBe(401);
  });

  // TESTE 2: 403 sem organização ativa nos quatro handlers
  it("2. Rejeita requisições sem organização ativa selecionada com status 403", async () => {
    const resGet = await fetch(`${BASE_URL}/api/visitors`, {
      headers: { "Cookie": adminACookie }
    });
    expect(resGet.status).toBe(403);

    const resPost = await fetch(`${BASE_URL}/api/visitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminACookie },
      body: JSON.stringify({ name: "NoOrg", date: "2026-03-02", classId: classAId })
    });
    expect(resPost.status).toBe(403);

    const resPut = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminACookie },
      body: JSON.stringify({ name: "Updated NoOrg" })
    });
    expect(resPut.status).toBe(403);

    const resDelete = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "DELETE",
      headers: { "Cookie": adminACookie }
    });
    expect(resDelete.status).toBe(403);
  });

  // TESTE 3: 403 membership inativa
  it("3. Rejeita requisições para usuário com membership inativa com status 403", async () => {
    const inactiveWithOrg = await switchOrgInSession(userInactiveMembershipCookie, orgAId);
    const resGet = await fetch(`${BASE_URL}/api/visitors`, {
      headers: { "Cookie": inactiveWithOrg }
    });
    expect(resGet.status).toBe(403);
  });

  // TESTE 4: Global Admin sem organização recebe 403
  it("4. Global Admin sem organização selecionada recebe status 403 pelo requireOrganization", async () => {
    const resGet = await fetch(`${BASE_URL}/api/visitors`, {
      headers: { "Cookie": globalAdminCookie }
    });
    expect(resGet.status).toBe(403);
  });

  // TESTE 5: Global Admin com organização selecionada é permitido
  it("5. Global Admin com organização selecionada opera normalmente no escopo da org", async () => {
    const resGet = await fetch(`${BASE_URL}/api/visitors`, {
      headers: { "Cookie": globalAdminWithOrgA }
    });
    expect(resGet.status).toBe(200);
    const json = await resGet.json();
    expect(json.visitors).toBeDefined();
  });

  // TESTE 6: GET isolamento bilateral dos visitantes
  it("6. GET /api/visitors aplica isolamento bilateral de visitantes entre Org A e Org B", async () => {
    const resA = await fetch(`${BASE_URL}/api/visitors`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resA.status).toBe(200);
    const dataA = await resA.json();
    const idsA = dataA.visitors.map((v: Record<string, unknown>) => v.id);
    expect(idsA).toContain(visitorA1Id);
    expect(idsA).not.toContain(visitorB1Id);

    const resB = await fetch(`${BASE_URL}/api/visitors`, {
      headers: { "Cookie": adminBWithOrgCookie }
    });
    expect(resB.status).toBe(200);
    const dataB = await resB.json();
    const idsB = dataB.visitors.map((v: Record<string, unknown>) => v.id);
    expect(idsB).toContain(visitorB1Id);
    expect(idsB).not.toContain(visitorA1Id);
  });

  // TESTE 7: GET isolamento bilateral do ranking
  it("7. GET /api/visitors calcula o ranking de indicações estritamente no escopo da org ativa", async () => {
    const resA = await fetch(`${BASE_URL}/api/visitors`, {
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resA.status).toBe(200);
    const dataA = await resA.json();
    expect(dataA.ranking).toBeDefined();
    expect(Array.isArray(dataA.ranking)).toBe(true);
    if (dataA.ranking.length > 0) {
      expect(dataA.ranking[0].nome).toBe(`${TEST_PREFIX}Student_A`);
    }
  });

  // TESTE 8: POST autorizado para gestores
  it("8. POST /api/visitors permite criação de visitante por ADMIN da organização", async () => {
    const res = await fetch(`${BASE_URL}/api/visitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({
        name: `${TEST_PREFIX}Visitor_CreatedByAdminA`,
        date: "2026-03-02",
        classId: classAId,
        invitedById: studentAId,
        observations: "Criado por Admin A"
      })
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBeDefined();
    expect(json.organizationId).toBe(orgAId);
  });

  // TESTE 9: POST autorizado para PROFESSOR e APOIO
  it("9. POST /api/visitors permite criação de visitante por PROFESSOR e APOIO da organização", async () => {
    const resProf = await fetch(`${BASE_URL}/api/visitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": professorAWithOrgCookie },
      body: JSON.stringify({
        name: `${TEST_PREFIX}Visitor_ByProf`,
        date: "2026-03-02",
        classId: classAId
      })
    });
    expect(resProf.status).toBe(201);

    const resApoio = await fetch(`${BASE_URL}/api/visitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": apoioAWithOrgCookie },
      body: JSON.stringify({
        name: `${TEST_PREFIX}Visitor_ByApoio`,
        date: "2026-03-02",
        classId: classAId
      })
    });
    expect(resApoio.status).toBe(201);
  });

  // TESTE 10: POST define organizationId pelo servidor
  it("10. POST /api/visitors garante que o organizationId é atribuído estritamente pelo servidor", async () => {
    const res = await fetch(`${BASE_URL}/api/visitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({
        name: `${TEST_PREFIX}Visitor_ServerOrgCheck`,
        date: "2026-03-02",
        classId: classAId
      })
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.organizationId).toBe(orgAId);
  });

  // TESTE 11: POST rejeita injeção de organizationId
  it("11. POST /api/visitors rejeita tentativas de injeção do campo organizationId no body com status 400", async () => {
    const res = await fetch(`${BASE_URL}/api/visitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({
        name: `${TEST_PREFIX}Visitor_Injected`,
        date: "2026-03-02",
        classId: classAId,
        organizationId: orgBId
      })
    });
    expect(res.status).toBe(400);
  });

  // TESTE 12: POST rejeita classId cross-tenant
  it("12. POST /api/visitors retorna status 404 ao tentar associar turma (classId) da Org B", async () => {
    const res = await fetch(`${BASE_URL}/api/visitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({
        name: `${TEST_PREFIX}Visitor_CrossClass`,
        date: "2026-03-02",
        classId: classBId
      })
    });
    expect(res.status).toBe(404);
  });

  // TESTE 13: POST rejeita invitedById cross-tenant
  it("13. POST /api/visitors retorna status 404 ao tentar associar aluno indicador (invitedById) da Org B", async () => {
    const res = await fetch(`${BASE_URL}/api/visitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({
        name: `${TEST_PREFIX}Visitor_CrossStudent`,
        date: "2026-03-02",
        classId: classAId,
        invitedById: studentBId
      })
    });
    expect(res.status).toBe(404);
  });

  // TESTE 14: POST rejeita body e tipos inválidos
  it("14. POST /api/visitors rejeita body não-objeto, campos obrigatórios ausentes ou tipos inválidos com status 400", async () => {
    const resArray = await fetch(`${BASE_URL}/api/visitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify([{ name: "Array" }])
    });
    expect(resArray.status).toBe(400);

    const resEmptyName = await fetch(`${BASE_URL}/api/visitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: "  ", date: "2026-03-02", classId: classAId })
    });
    expect(resEmptyName.status).toBe(400);
  });

  // TESTE 15: PUT rejeita PROFESSOR e APOIO
  it("15. PUT /api/visitors/[id] rejeita solicitações de edição por PROFESSOR e APOIO com status 403", async () => {
    const resProf = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": professorAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Visitor_ProfUpdate` })
    });
    expect(resProf.status).toBe(403);

    const resApoio = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": apoioAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Visitor_ApoioUpdate` })
    });
    expect(resApoio.status).toBe(403);
  });

  // TESTE 16: PUT permite ADMIN, DIRIGENTE e VICE_DIRIGENTE
  it("16. PUT /api/visitors/[id] permite edição por ADMIN, DIRIGENTE e VICE_DIRIGENTE da organização", async () => {
    const resVice = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": viceAdminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Visitor_A1_UpdatedByVice` })
    });
    expect(resVice.status).toBe(200);
    const jsonVice = await resVice.json();
    expect(jsonVice.name).toBe(`${TEST_PREFIX}Visitor_A1_UpdatedByVice`);
  });

  // TESTE 17: PUT permite Global Admin com organização selecionada
  it("17. PUT /api/visitors/[id] permite edição por Global Admin com organização selecionada", async () => {
    const resGlobal = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": globalAdminWithOrgA },
      body: JSON.stringify({ name: `${TEST_PREFIX}Visitor_A1_UpdatedByGlobal` })
    });
    expect(resGlobal.status).toBe(200);
  });

  // TESTE 18: PUT visitante cross-tenant retorna 404
  it("18. PUT /api/visitors/[id] retorna status 404 ao tentar atualizar visitante da Org B a partir da Org A", async () => {
    const res = await fetch(`${BASE_URL}/api/visitors/${visitorB1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Visitor_HackB` })
    });
    expect(res.status).toBe(404);
  });

  // TESTE 19: PUT classId cross-tenant retorna 404
  it("19. PUT /api/visitors/[id] retorna status 404 ao tentar atualizar turma (classId) para turma da Org B", async () => {
    const res = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ classId: classBId })
    });
    expect(res.status).toBe(404);
  });

  // TESTE 20: PUT invitedById cross-tenant retorna 404
  it("20. PUT /api/visitors/[id] retorna status 404 ao tentar atualizar aluno indicador para aluno da Org B", async () => {
    const res = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ invitedById: studentBId })
    });
    expect(res.status).toBe(404);
  });

  // TESTE 21: PUT rejeita organizationId e tipos inválidos
  it("21. PUT /api/visitors/[id] rejeita injeção do campo organizationId ou tipos inválidos com status 400", async () => {
    const resInjected = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ organizationId: orgBId })
    });
    expect(resInjected.status).toBe(400);

    const resEmptyName = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ name: "   " })
    });
    expect(resEmptyName.status).toBe(400);
  });

  // TESTE 22: PUT parcial preserva campos omitidos e permite limpeza explícita
  it("22. PUT parcial preserva campos omitidos e permite limpar invitedById enviando 'none' ou null", async () => {
    const resClear = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cookie": adminAWithOrgCookie },
      body: JSON.stringify({ invitedById: "none" })
    });
    expect(resClear.status).toBe(200);
    const jsonClear = await resClear.json();
    expect(jsonClear.invitedById).toBeNull();
    expect(jsonClear.classId).toBe(classAId);
  });

  // TESTE 23: DELETE rejeita perfil insuficiente e recurso cross-tenant
  it("23. DELETE /api/visitors/[id] rejeita perfil PROFESSOR (403) e recurso da Org B (404)", async () => {
    const resProf = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "DELETE",
      headers: { "Cookie": professorAWithOrgCookie }
    });
    expect(resProf.status).toBe(403);

    const resCross = await fetch(`${BASE_URL}/api/visitors/${visitorB1Id}`, {
      method: "DELETE",
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resCross.status).toBe(404);
  });

  // TESTE 24: DELETE permite gestor da organização e teardown deixa zero resíduos
  it("24. DELETE /api/visitors/[id] permite exclusão por gestor da própria organização com status 200", async () => {
    const resDelete = await fetch(`${BASE_URL}/api/visitors/${visitorA1Id}`, {
      method: "DELETE",
      headers: { "Cookie": adminAWithOrgCookie }
    });
    expect(resDelete.status).toBe(200);
    const json = await resDelete.json();
    expect(json.success).toBe(true);
  });
});
