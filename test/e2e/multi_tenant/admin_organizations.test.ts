import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const BASE_URL = "http://127.0.0.1:3100";
const TEST_PREFIX = "e2e_admin_org_";

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
        if (
          name &&
          !["path", "httponly", "samesite", "domain", "expires", "max-age"].includes(name.toLowerCase())
        ) {
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
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  const cookieHeader1 = mergeCookies(null, csrfRes.headers.get("set-cookie"));

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader1,
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password: "password123",
      json: "true",
    }),
    redirect: "manual",
  });

  return mergeCookies(cookieHeader1, loginRes.headers.get("set-cookie"));
}

async function switchOrgInSession(initialCookie: string, orgId: string): Promise<string> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`, {
    headers: { Cookie: initialCookie },
  });
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  const cookieHeader = mergeCookies(initialCookie, csrfRes.headers.get("set-cookie"));

  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      csrfToken,
      data: { activeOrganizationId: orgId },
    }),
  });

  return mergeCookies(cookieHeader, sessionRes.headers.get("set-cookie"));
}

describe("Admin Global Organizations — Security & Multi-Tenant E2E", () => {
  const runSuffix = Date.now().toString();
  const createdOrgIds = new Set<string>();
  const createdUserIds = new Set<string>();
  const createdClassIds = new Set<string>();
  const createdStudentIds = new Set<string>();

  let orgAId = "";
  let orgBId = "";
  let orgBSlug = "";
  let classAId = "";
  let classBId = "";
  let studentAId = "";
  let studentBId = "";

  let globalAdminCookie = "";
  let globalAdminWithOrgBCookie = "";
  let adminACookie = "";
  let adminAWithOrgCookie = "";

  let cleanupAuthorized = false;

  beforeAll(async () => {
    const dbNameResult = await prisma.$queryRaw<Array<{ dbName: string }>>`SELECT DATABASE() as dbName`;
    const currentDb = dbNameResult[0]?.dbName;
    if (currentDb !== "u223033896_ebd_test") {
      throw new Error(
        `EXECUÇÃO BARRADA: Banco de dados inválido. Esperado u223033896_ebd_test, recebido: ${currentDb}`
      );
    }

    const initialCounts = await countBusinessTables();
    const nonZeroInitial = initialCounts.filter((c) => c.count > 0);
    if (nonZeroInitial.length > 0) {
      const details = nonZeroInitial.map((c) => `${c.tableName}: ${c.count}`).join(", ");
      throw new Error(`EXECUÇÃO BARRADA: Banco de testes contém registros preexistentes: ${details}`);
    }

    cleanupAuthorized = true;

    const orgA = await prisma.organization.create({
      data: {
        name: `${TEST_PREFIX}Congregacao_A`,
        slug: `e2e-admin-org-a-${runSuffix}`,
        active: true,
      },
    });
    orgAId = orgA.id;
    createdOrgIds.add(orgAId);

    const classA = await prisma.class.create({
      data: {
        name: `${TEST_PREFIX}Turma_A`,
        organizationId: orgAId,
        status: true,
      },
    });
    classAId = classA.id;
    createdClassIds.add(classAId);

    const studentA = await prisma.student.create({
      data: {
        name: `${TEST_PREFIX}Aluno_A`,
        classId: classAId,
        organizationId: orgAId,
        active: true,
      },
    });
    studentAId = studentA.id;
    createdStudentIds.add(studentAId);

    const hashedPassword = await bcrypt.hash("password123", 10);

    const globalAdmin = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Global_Admin`,
        email: `${TEST_PREFIX}global_${runSuffix}@test.com`,
        password: hashedPassword,
        role: "ADMIN",
        isGlobalAdmin: true,
        active: true,
      },
    });
    createdUserIds.add(globalAdmin.id);

    const adminA = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Admin_A`,
        email: `${TEST_PREFIX}admin_a_${runSuffix}@test.com`,
        password: hashedPassword,
        role: "ADMIN",
        isGlobalAdmin: false,
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
    createdUserIds.add(adminA.id);

    globalAdminCookie = await loginAndGetCookie(globalAdmin.email);
    adminACookie = await loginAndGetCookie(adminA.email);
    adminAWithOrgCookie = await switchOrgInSession(adminACookie, orgAId);
  }, 60_000);

  afterAll(async () => {
    if (!cleanupAuthorized) return;

    try {
      const orgIds = Array.from(createdOrgIds);
      const userIds = Array.from(createdUserIds);
      const classIds = Array.from(createdClassIds);
      const studentIds = Array.from(createdStudentIds);

      await prisma.student.deleteMany({
        where: {
          OR: [
            { id: { in: studentIds } },
            { organizationId: { in: orgIds } },
            { name: { startsWith: TEST_PREFIX } },
          ],
        },
      });

      await prisma.classStaffAssignment.deleteMany({
        where: {
          OR: [{ organizationId: { in: orgIds } }, { classId: { in: classIds } }],
        },
      });

      await prisma.class.deleteMany({
        where: {
          OR: [
            { id: { in: classIds } },
            { organizationId: { in: orgIds } },
            { name: { startsWith: TEST_PREFIX } },
          ],
        },
      });

      await prisma.organizationMembership.deleteMany({
        where: {
          OR: [{ organizationId: { in: orgIds } }, { userId: { in: userIds } }],
        },
      });

      await prisma.user.updateMany({
        where: {
          OR: [{ id: { in: userIds } }, { name: { startsWith: TEST_PREFIX } }],
        },
        data: { classId: null },
      });

      await prisma.user.deleteMany({
        where: {
          OR: [{ id: { in: userIds } }, { name: { startsWith: TEST_PREFIX } }],
        },
      });

      await prisma.organization.deleteMany({
        where: {
          OR: [{ id: { in: orgIds } }, { name: { startsWith: TEST_PREFIX } }],
        },
      });

      const finalCounts = await countBusinessTables();
      const nonZeroFinal = finalCounts.filter((c) => c.count > 0);
      if (nonZeroFinal.length > 0) {
        const details = nonZeroFinal.map((c) => `${c.tableName}: ${c.count}`).join(", ");
        throw new Error(`LEAK_DETECTED: Registros residuais após afterAll: ${details}`);
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it("1. Bloqueia anônimo (401) e usuário comum / ADMIN local (403) em todas as rotas de /api/admin/organizations", async () => {
    const anonGet = await fetch(`${BASE_URL}/api/admin/organizations`);
    expect(anonGet.status).toBe(401);

    const anonPost = await fetch(`${BASE_URL}/api/admin/organizations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Anon Org", slug: "anon-org" }),
    });
    expect(anonPost.status).toBe(401);

    const anonPatch = await fetch(`${BASE_URL}/api/admin/organizations/${orgAId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    expect(anonPatch.status).toBe(401);

    const anonDelete = await fetch(`${BASE_URL}/api/admin/organizations/${orgAId}`, {
      method: "DELETE",
    });
    expect(anonDelete.status).toBe(401);

    const localGet = await fetch(`${BASE_URL}/api/admin/organizations`, {
      headers: { Cookie: adminAWithOrgCookie },
    });
    expect(localGet.status).toBe(403);

    const localPost = await fetch(`${BASE_URL}/api/admin/organizations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminAWithOrgCookie },
      body: JSON.stringify({ name: "Local Org", slug: "local-org" }),
    });
    expect(localPost.status).toBe(403);

    const localPatch = await fetch(`${BASE_URL}/api/admin/organizations/${orgAId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminAWithOrgCookie },
      body: JSON.stringify({ name: "Hijack Org A" }),
    });
    expect(localPatch.status).toBe(403);

    const localDelete = await fetch(`${BASE_URL}/api/admin/organizations/${orgAId}`, {
      method: "DELETE",
      headers: { Cookie: adminAWithOrgCookie },
    });
    expect(localDelete.status).toBe(403);
  });

  it("2. Global Admin cria nova congregação (Org B), lista e edita nome e slug com validações estritas", async () => {
    orgBSlug = `e2e-admin-org-b-${runSuffix}`;

    const createRes = await fetch(`${BASE_URL}/api/admin/organizations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: globalAdminCookie },
      body: JSON.stringify({
        name: `${TEST_PREFIX}Congregacao_B`,
        slug: orgBSlug,
      }),
    });
    expect(createRes.status).toBe(201);
    const createdOrg = await createRes.json();
    expect(createdOrg.name).toBe(`${TEST_PREFIX}Congregacao_B`);
    expect(createdOrg.slug).toBe(orgBSlug);
    expect(createdOrg.active).toBe(true);
    orgBId = createdOrg.id;
    createdOrgIds.add(orgBId);

    // Garantir que Settings não foi criado automaticamente
    const settingsCount = await prisma.settings.count();
    expect(settingsCount).toBe(0);

    // Listar via GET
    const listRes = await fetch(`${BASE_URL}/api/admin/organizations`, {
      headers: { Cookie: globalAdminCookie },
    });
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as Array<{ id: string; slug: string }>;
    expect(Array.isArray(listData)).toBe(true);
    expect(listData.some((o) => o.id === orgAId)).toBe(true);
    expect(listData.some((o) => o.id === orgBId)).toBe(true);

    // Rejeitar slug duplicado com 409
    const dupRes = await fetch(`${BASE_URL}/api/admin/organizations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: globalAdminCookie },
      body: JSON.stringify({
        name: `${TEST_PREFIX}Duplicada`,
        slug: orgBSlug,
      }),
    });
    expect(dupRes.status).toBe(409);

    // Rejeitar payload inválido / campos não permitidos com 400
    const badRes = await fetch(`${BASE_URL}/api/admin/organizations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: globalAdminCookie },
      body: JSON.stringify({
        id: "forced-id",
        name: `${TEST_PREFIX}Bad`,
        slug: "Slug Inválido",
      }),
    });
    expect(badRes.status).toBe(400);

    // Editar nome e slug via PATCH
    const updatedSlug = `${orgBSlug}-editado`;
    const patchRes = await fetch(`${BASE_URL}/api/admin/organizations/${orgBId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: globalAdminCookie },
      body: JSON.stringify({
        name: `${TEST_PREFIX}Congregacao_B_Editada`,
        slug: updatedSlug,
      }),
    });
    expect(patchRes.status).toBe(200);
    const updatedOrg = await patchRes.json();
    expect(updatedOrg.name).toBe(`${TEST_PREFIX}Congregacao_B_Editada`);
    expect(updatedOrg.slug).toBe(updatedSlug);
    orgBSlug = updatedSlug;

    // PATCH em ID inexistente retorna 404
    const notFoundRes = await fetch(`${BASE_URL}/api/admin/organizations/org-inexistente-${runSuffix}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: globalAdminCookie },
      body: JSON.stringify({ name: "Inexistente" }),
    });
    expect(notFoundRes.status).toBe(404);

    // DELETE é bloqueado explicitamente com 405
    const deleteRes = await fetch(`${BASE_URL}/api/admin/organizations/${orgBId}`, {
      method: "DELETE",
      headers: { Cookie: globalAdminCookie },
    });
    expect(deleteRes.status).toBe(405);

    const stillExists = await prisma.organization.findUnique({ where: { id: orgBId } });
    expect(stillExists).not.toBeNull();
  });

  it("3. Global Admin acessa Org B via switch-org e confirma isolamento multi-tenant estrito", async () => {
    // 1. Autorização de troca via /api/auth/switch-org (mesmo endpoint do OrgAccessButton)
    const switchAuthRes = await fetch(`${BASE_URL}/api/auth/switch-org`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: globalAdminCookie },
      body: JSON.stringify({ organizationId: orgBId }),
    });
    expect(switchAuthRes.status).toBe(200);
    const switchJson = await switchAuthRes.json();
    expect(switchJson.success).toBe(true);

    // 2. Atualizar JWT da sessão para activeOrganizationId = orgBId
    globalAdminWithOrgBCookie = await switchOrgInSession(globalAdminCookie, orgBId);

    // 3. Criar turma operacional dentro da Org B usando o contexto do Global Admin em Org B
    const createClassRes = await fetch(`${BASE_URL}/api/classes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: globalAdminWithOrgBCookie },
      body: JSON.stringify({
        name: `${TEST_PREFIX}Turma_B`,
        description: "Turma criada pelo Global Admin em Org B",
        audience: "Adultos",
        active: true,
      }),
    });
    expect(createClassRes.status).toBe(201);
    const createdClass = await createClassRes.json();
    classBId = createdClass.id;
    createdClassIds.add(classBId);
    expect(createdClass.organizationId).toBe(orgBId);

    // Criar aluno operacional na Org B para confirmar isolamento completo
    const createStudentRes = await fetch(`${BASE_URL}/api/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: globalAdminWithOrgBCookie },
      body: JSON.stringify({
        name: `${TEST_PREFIX}Aluno_B`,
        classId: classBId,
      }),
    });
    expect(createStudentRes.status).toBe(201);
    const createdStudent = await createStudentRes.json();
    studentBId = createdStudent.id;
    createdStudentIds.add(studentBId);
    expect(createdStudent.organizationId).toBe(orgBId);

    // 4. Confirmar isolamento: Global Admin na Org B enxerga apenas dados de Org B
    const classesOrgBRes = await fetch(`${BASE_URL}/api/classes`, {
      headers: { Cookie: globalAdminWithOrgBCookie },
    });
    expect(classesOrgBRes.status).toBe(200);
    const classesOrgB = (await classesOrgBRes.json()) as Array<{ id: string }>;
    expect(classesOrgB.some((c) => c.id === classBId)).toBe(true);
    expect(classesOrgB.some((c) => c.id === classAId)).toBe(false);

    const studentsOrgBRes = await fetch(`${BASE_URL}/api/students`, {
      headers: { Cookie: globalAdminWithOrgBCookie },
    });
    expect(studentsOrgBRes.status).toBe(200);
    const studentsOrgB = (await studentsOrgBRes.json()) as Array<{ id: string }>;
    expect(studentsOrgB.some((s) => s.id === studentBId)).toBe(true);
    expect(studentsOrgB.some((s) => s.id === studentAId)).toBe(false);

    // 5. Confirmar isolamento reverso: ADMIN da Org A enxerga apenas Org A e não acessa Org B
    const classesOrgARes = await fetch(`${BASE_URL}/api/classes`, {
      headers: { Cookie: adminAWithOrgCookie },
    });
    expect(classesOrgARes.status).toBe(200);
    const classesOrgA = (await classesOrgARes.json()) as Array<{ id: string }>;
    expect(classesOrgA.some((c) => c.id === classAId)).toBe(true);
    expect(classesOrgA.some((c) => c.id === classBId)).toBe(false);

    const unauthorizedSwitchRes = await fetch(`${BASE_URL}/api/auth/switch-org`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminACookie },
      body: JSON.stringify({ organizationId: orgBId }),
    });
    expect(unauthorizedSwitchRes.status).toBe(403);
  });

  it("4. Desativar Org B bloqueia switch-org e derruba acesso operacional com cookie ativo", async () => {
    const deactivateRes = await fetch(`${BASE_URL}/api/admin/organizations/${orgBId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: globalAdminCookie },
      body: JSON.stringify({ active: false }),
    });
    expect(deactivateRes.status).toBe(200);
    const deactivated = await deactivateRes.json();
    expect(deactivated.active).toBe(false);

    // Novo switch-org para Org B é bloqueado mesmo para Global Admin
    const blockedSwitchRes = await fetch(`${BASE_URL}/api/auth/switch-org`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: globalAdminCookie },
      body: JSON.stringify({ organizationId: orgBId }),
    });
    expect(blockedSwitchRes.status).toBe(403);

    // Sessão operacional preexistente do Global Admin apontando para Org B é barrada imediatamente
    const blockedClassesGet = await fetch(`${BASE_URL}/api/classes`, {
      headers: { Cookie: globalAdminWithOrgBCookie },
    });
    expect(blockedClassesGet.status).toBe(403);

    const blockedClassesPost = await fetch(`${BASE_URL}/api/classes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: globalAdminWithOrgBCookie },
      body: JSON.stringify({ name: `${TEST_PREFIX}Blocked`, active: true }),
    });
    expect(blockedClassesPost.status).toBe(403);

    const blockedStudentsGet = await fetch(`${BASE_URL}/api/students`, {
      headers: { Cookie: globalAdminWithOrgBCookie },
    });
    expect(blockedStudentsGet.status).toBe(403);
  });

  it("5. Impede desativar a última congregação ativa (409) e permite após reativar Org B", async () => {
    // Agora Org A é a única congregação ativa no banco de testes
    const blockLastRes = await fetch(`${BASE_URL}/api/admin/organizations/${orgAId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: globalAdminCookie },
      body: JSON.stringify({ active: false }),
    });
    expect(blockLastRes.status).toBe(409);
    const blockBody = await blockLastRes.json();
    expect(blockBody.error).toBe("Não é possível desativar a última congregação ativa do sistema.");

    const orgAAfterBlock = await prisma.organization.findUnique({ where: { id: orgAId } });
    expect(orgAAfterBlock?.active).toBe(true);

    // Reativando Org B, Org A pode ser desativada normalmente e acesso a Org B volta a funcionar
    const reactivateRes = await fetch(`${BASE_URL}/api/admin/organizations/${orgBId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: globalAdminCookie },
      body: JSON.stringify({ active: true }),
    });
    expect(reactivateRes.status).toBe(200);

    const restoredSwitchRes = await fetch(`${BASE_URL}/api/auth/switch-org`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: globalAdminCookie },
      body: JSON.stringify({ organizationId: orgBId }),
    });
    expect(restoredSwitchRes.status).toBe(200);
  });
});
