import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const BASE_URL = "http://127.0.0.1:3100";
const TEST_PREFIX = "e2e_usr_access_";
const DEFAULT_PASSWORD = "Password123!";

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

async function loginAndGetCookie(
  email: string,
  password: string = DEFAULT_PASSWORD
): Promise<string> {
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
      password,
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

describe("Gestão de Acessos via OrganizationMembership — E2E & Isolamento Multi-Tenant", () => {
  const runSuffix = Date.now().toString();
  const createdOrgIds = new Set<string>();
  const createdUserIds = new Set<string>();
  const createdClassIds = new Set<string>();

  let orgAId = "";
  let orgBId = "";
  let classBId = "";

  let globalAdminId = "";
  let adminAUserId = "";
  let profAUserId = "";
  let sharedUserId = "";
  let sharedUserOrgAMembershipId = "";

  let orgBNewAdminUserId = "";
  let orgBNewAdminMembershipId = "";
  let sharedUserOrgBMembershipId = "";

  let globalAdminCookie = "";
  let globalAdminOrgBCookie = "";
  let adminACookie = "";
  let profACookie = "";

  const sharedEmail = `${TEST_PREFIX}shared_${runSuffix}@test.com`;
  const orgBNewAdminEmail = `${TEST_PREFIX}admin_b_${runSuffix}@test.com`;
  const orgBNewAdminPassword = "AdminBSenhaForte123!";
  const sharedOriginalPassword = "SharedOriginalPassword123!";

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
        name: `${TEST_PREFIX}Sede Principal`,
        slug: `e2e-usr-sede-${runSuffix}`,
        active: true,
      },
    });
    orgAId = orgA.id;
    createdOrgIds.add(orgAId);

    const orgB = await prisma.organization.create({
      data: {
        name: `${TEST_PREFIX}IV DIRES - TESTE`,
        slug: `e2e-usr-iv-dires-${runSuffix}`,
        active: true,
      },
    });
    orgBId = orgB.id;
    createdOrgIds.add(orgBId);

    const classB = await prisma.class.create({
      data: {
        name: `${TEST_PREFIX}Turma IV DIRES`,
        organizationId: orgBId,
        status: true,
      },
    });
    classBId = classB.id;
    createdClassIds.add(classBId);

    const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const sharedHash = await bcrypt.hash(sharedOriginalPassword, 10);

    const globalAdmin = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Global Admin`,
        email: `${TEST_PREFIX}global_${runSuffix}@test.com`,
        password: defaultHash,
        role: "ADMIN",
        isGlobalAdmin: true,
        active: true,
      },
    });
    globalAdminId = globalAdmin.id;
    createdUserIds.add(globalAdminId);

    const adminA = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Admin Sede`,
        email: `${TEST_PREFIX}admin_a_${runSuffix}@test.com`,
        password: defaultHash,
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
    adminAUserId = adminA.id;
    createdUserIds.add(adminAUserId);

    const profA = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Professor Sede`,
        email: `${TEST_PREFIX}prof_a_${runSuffix}@test.com`,
        password: defaultHash,
        role: "PROFESSOR",
        isGlobalAdmin: false,
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
    profAUserId = profA.id;
    createdUserIds.add(profAUserId);

    const sharedUser = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX}Shared User`,
        email: sharedEmail,
        password: sharedHash,
        role: "PROFESSOR",
        isGlobalAdmin: false,
        active: true,
        memberships: {
          create: {
            organizationId: orgAId,
            role: "PROFESSOR",
            status: "ACTIVE",
          },
        },
      },
      include: {
        memberships: true,
      },
    });
    sharedUserId = sharedUser.id;
    sharedUserOrgAMembershipId = sharedUser.memberships[0].id;
    createdUserIds.add(sharedUserId);

    globalAdminCookie = await loginAndGetCookie(globalAdmin.email);
    adminACookie = await switchOrgInSession(
      await loginAndGetCookie(adminA.email),
      orgAId
    );
    profACookie = await switchOrgInSession(
      await loginAndGetCookie(profA.email),
      orgAId
    );

    const switchRes = await fetch(`${BASE_URL}/api/auth/switch-org`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: globalAdminCookie },
      body: JSON.stringify({ organizationId: orgBId }),
    });
    if (!switchRes.ok) {
      throw new Error(`Falha ao preparar switch-org do Global Admin: ${switchRes.status}`);
    }
    globalAdminOrgBCookie = await switchOrgInSession(globalAdminCookie, orgBId);
  }, 60_000);

  afterAll(async () => {
    if (!cleanupAuthorized) return;

    try {
      const orgIds = Array.from(createdOrgIds);
      const userIds = Array.from(createdUserIds);
      const classIds = Array.from(createdClassIds);

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
          OR: [
            { id: { in: userIds } },
            { email: { startsWith: TEST_PREFIX } },
            { name: { startsWith: TEST_PREFIX } },
          ],
        },
        data: { classId: null },
      });

      await prisma.user.deleteMany({
        where: {
          OR: [
            { id: { in: userIds } },
            { email: { startsWith: TEST_PREFIX } },
            { name: { startsWith: TEST_PREFIX } },
          ],
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

  it("1. Bloqueia anônimo (401) e usuário não-ADMIN (403) em /api/users, mantendo /api/profile funcional", async () => {
    const anonUsers = await fetch(`${BASE_URL}/api/users`);
    expect(anonUsers.status).toBe(401);

    const anonProfile = await fetch(`${BASE_URL}/api/profile`);
    expect(anonProfile.status).toBe(401);

    const profUsers = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: profACookie },
    });
    expect(profUsers.status).toBe(403);

    const profProfile = await fetch(`${BASE_URL}/api/profile`, {
      headers: { Cookie: profACookie },
    });
    expect(profProfile.status).toBe(200);
    const profData = await profProfile.json();
    expect(profData.id).toBe(profAUserId);
    expect(profData.password).toBeUndefined();
  });

  it("2. Global Admin acessando Congregação B sem vínculo vê lista vazia (sem vazar Org A ou Global Admin)", async () => {
    const listOrgB = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: globalAdminOrgBCookie },
    });
    expect(listOrgB.status).toBe(200);
    const itemsOrgB = await listOrgB.json();
    expect(itemsOrgB).toEqual([]);

    const listOrgA = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: adminACookie },
    });
    expect(listOrgA.status).toBe(200);
    const itemsOrgA = (await listOrgA.json()) as Array<{ userId: string }>;
    const idsOrgA = itemsOrgA.map((u) => u.userId);
    expect(idsOrgA).toContain(adminAUserId);
    expect(idsOrgA).toContain(profAUserId);
    expect(idsOrgA).toContain(sharedUserId);
    expect(idsOrgA).not.toContain(globalAdminId);
  });

  it("3. Criar usuário ADMIN na Congregação B cria User + OrganizationMembership ACTIVE na mesma transação e permite login real", async () => {
    const createRes = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: globalAdminOrgBCookie,
      },
      body: JSON.stringify({
        name: `${TEST_PREFIX}Admin IV Dires`,
        email: orgBNewAdminEmail.toUpperCase(),
        password: orgBNewAdminPassword,
        role: "ADMIN",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.email).toBe(orgBNewAdminEmail);
    expect(created.role).toBe("ADMIN");
    expect(created.organizationId).toBe(orgBId);
    expect(created.status).toBe("ACTIVE");
    expect(created.linkedExistingUser).toBe(false);

    orgBNewAdminUserId = created.userId;
    orgBNewAdminMembershipId = created.membershipId;
    createdUserIds.add(orgBNewAdminUserId);

    // Conferir diretamente no banco que User + OrganizationMembership foram criados corretamente
    const dbMembership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: orgBNewAdminUserId,
          organizationId: orgBId,
        },
      },
      include: { user: true },
    });
    expect(dbMembership).not.toBeNull();
    expect(dbMembership?.status).toBe("ACTIVE");
    expect(dbMembership?.role).toBe("ADMIN");
    expect(dbMembership?.user.isGlobalAdmin).toBe(false);

    // Novo ADMIN entra no sistema sem erro "Acesso Negado" e recebe membership da Congregação B na sessão
    const newAdminLoginCookie = await loginAndGetCookie(
      orgBNewAdminEmail,
      orgBNewAdminPassword
    );
    const loginSessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: newAdminLoginCookie },
    });
    expect(loginSessionRes.status).toBe(200);
    const loginSessionJson = await loginSessionRes.json();
    expect(loginSessionJson?.user?.isGlobalAdmin).toBe(false);
    expect(loginSessionJson?.user?.memberships).toHaveLength(1);
    expect(loginSessionJson?.user?.memberships[0]).toMatchObject({
      organizationId: orgBId,
      role: "ADMIN",
    });

    // Seleção automática da congregação (mesmo POST /api/auth/session executado em /select-organization)
    const newAdminCookie = await switchOrgInSession(newAdminLoginCookie, orgBId);
    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: newAdminCookie },
    });
    expect(sessionRes.status).toBe(200);
    const sessionJson = await sessionRes.json();
    expect(sessionJson?.user?.activeOrganizationId).toBe(orgBId);

    // Consegue acessar /dashboard e /api/users da Congregação B, mas NÃO acessa Admin Global (/admin /api/admin/organizations)
    const dashboardRes = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: newAdminCookie },
      redirect: "manual",
    });
    expect(dashboardRes.status).toBe(200);

    const orgBUsersRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: newAdminCookie },
    });
    expect(orgBUsersRes.status).toBe(200);
    const orgBUsers = (await orgBUsersRes.json()) as Array<{ userId: string }>;
    expect(orgBUsers.map((u) => u.userId)).toEqual([orgBNewAdminUserId]);

    const adminOrgApiRes = await fetch(`${BASE_URL}/api/admin/organizations`, {
      headers: { Cookie: newAdminCookie },
    });
    expect(adminOrgApiRes.status).toBe(403);

    const adminPageRes = await fetch(`${BASE_URL}/admin/organizations`, {
      headers: { Cookie: newAdminCookie },
      redirect: "manual",
    });
    expect([302, 307]).toContain(adminPageRes.status);
  });

  it("4. Vincular e-mail existente na Congregação B não duplica User, preserva senha original e bloqueia duplicidade (409)", async () => {
    const newAdminOrgBCookie = await switchOrgInSession(
      await loginAndGetCookie(orgBNewAdminEmail, orgBNewAdminPassword),
      orgBId
    );

    const linkRes = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: newAdminOrgBCookie,
      },
      body: JSON.stringify({
        name: "Tentativa Mudar Nome",
        email: sharedEmail,
        password: "TentativaMudarSenha999!",
        role: "DIRIGENTE",
      }),
    });
    expect(linkRes.status).toBe(201);
    const linked = await linkRes.json();
    expect(linked.userId).toBe(sharedUserId);
    expect(linked.organizationId).toBe(orgBId);
    expect(linked.role).toBe("DIRIGENTE");
    expect(linked.linkedExistingUser).toBe(true);
    sharedUserOrgBMembershipId = linked.membershipId;

    // Sem duplicação em users e senha original 100% preservada
    const matchingUsers = await prisma.user.findMany({
      where: { email: sharedEmail },
    });
    expect(matchingUsers).toHaveLength(1);
    const passwordIntact = await bcrypt.compare(
      sharedOriginalPassword,
      matchingUsers[0].password
    );
    expect(passwordIntact).toBe(true);

    // Tentativa repetida na mesma congregação retorna 409
    const duplicateRes = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: newAdminOrgBCookie,
      },
      body: JSON.stringify({
        email: sharedEmail,
        role: "ADMIN",
      }),
    });
    expect(duplicateRes.status).toBe(409);

    // Criar atribuição de turma na Org B para validar limpeza no DELETE
    await prisma.classStaffAssignment.create({
      data: {
        organizationId: orgBId,
        classId: classBId,
        organizationMembershipId: sharedUserOrgBMembershipId,
        assignmentRole: "PROFESSOR",
        active: true,
      },
    });
  });

  it("5. Editar perfil altera apenas o role na congregação atual e protege credenciais globais e cross-tenant", async () => {
    const newAdminOrgBCookie = await switchOrgInSession(
      await loginAndGetCookie(orgBNewAdminEmail, orgBNewAdminPassword),
      orgBId
    );

    // Alterar role na Org B para VICE_DIRIGENTE
    const editRoleRes = await fetch(
      `${BASE_URL}/api/users/${sharedUserOrgBMembershipId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: newAdminOrgBCookie,
        },
        body: JSON.stringify({
          role: "VICE_DIRIGENTE",
        }),
      }
    );
    expect(editRoleRes.status).toBe(200);
    expect((await editRoleRes.json()).role).toBe("VICE_DIRIGENTE");

    // Org A permanece com role PROFESSOR inalterado
    const orgAMem = await prisma.organizationMembership.findUnique({
      where: { id: sharedUserOrgAMembershipId },
    });
    expect(orgAMem?.role).toBe("PROFESSOR");

    // Admin de Org B não pode alterar senha do usuário compartilhado (403)
    const passwordTamperRes = await fetch(
      `${BASE_URL}/api/users/${sharedUserOrgBMembershipId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: newAdminOrgBCookie,
        },
        body: JSON.stringify({
          role: "VICE_DIRIGENTE",
          password: "RouboDeSenha123!",
        }),
      }
    );
    expect(passwordTamperRes.status).toBe(403);

    // Admin de Org A não consegue editar nem excluir vínculo exclusivo de Org B (404)
    const crossEditRes = await fetch(
      `${BASE_URL}/api/users/${orgBNewAdminMembershipId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminACookie,
        },
        body: JSON.stringify({ role: "APOIO" }),
      }
    );
    expect(crossEditRes.status).toBe(404);

    const crossDelByUserIdRes = await fetch(
      `${BASE_URL}/api/users/${orgBNewAdminUserId}`,
      {
        method: "DELETE",
        headers: { Cookie: adminACookie },
      }
    );
    expect(crossDelByUserIdRes.status).toBe(404);
  });

  it("6. Remover acesso inativa somente o membership da congregação atual (preserva User e outro vínculo) e permite reativar", async () => {
    const newAdminOrgBCookie = await switchOrgInSession(
      await loginAndGetCookie(orgBNewAdminEmail, orgBNewAdminPassword),
      orgBId
    );

    // Remover usuário compartilhado apenas da Congregação B
    const removeRes = await fetch(
      `${BASE_URL}/api/users/${sharedUserOrgBMembershipId}`,
      {
        method: "DELETE",
        headers: { Cookie: newAdminOrgBCookie },
      }
    );
    expect(removeRes.status).toBe(200);

    // Membership Org B -> INACTIVE; atribuição em turma Org B -> false
    const memOrgBAfter = await prisma.organizationMembership.findUnique({
      where: { id: sharedUserOrgBMembershipId },
    });
    expect(memOrgBAfter?.status).toBe("INACTIVE");

    const assignmentAfter = await prisma.classStaffAssignment.findFirst({
      where: {
        organizationId: orgBId,
        organizationMembershipId: sharedUserOrgBMembershipId,
      },
    });
    expect(assignmentAfter?.active).toBe(false);

    // Usuário global continua ativo e membership da Org A continua ACTIVE
    const dbSharedUser = await prisma.user.findUnique({
      where: { id: sharedUserId },
    });
    expect(dbSharedUser?.active).toBe(true);

    const memOrgAAfter = await prisma.organizationMembership.findUnique({
      where: { id: sharedUserOrgAMembershipId },
    });
    expect(memOrgAAfter?.status).toBe("ACTIVE");
    expect(memOrgAAfter?.role).toBe("PROFESSOR");

    // Usuário compartilhado ainda faz login normalmente na Org A, mas NÃO possui mais acesso à Org B
    const sharedLoginCookie = await loginAndGetCookie(
      sharedEmail,
      sharedOriginalPassword
    );
    const sharedInitialSessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: sharedLoginCookie },
    });
    const sharedInitialSession = await sharedInitialSessionRes.json();
    expect(sharedInitialSession?.user?.memberships).toHaveLength(1);
    expect(sharedInitialSession?.user?.memberships[0]?.organizationId).toBe(orgAId);

    const blockedOrgBCookie = await switchOrgInSession(sharedLoginCookie, orgBId);
    const blockedOrgBSessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: blockedOrgBCookie },
    });
    const blockedOrgBSession = await blockedOrgBSessionRes.json();
    expect(blockedOrgBSession?.user?.activeOrganizationId).toBeFalsy();

    const sharedOrgACookie = await switchOrgInSession(sharedLoginCookie, orgAId);
    const sharedSessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: sharedOrgACookie },
    });
    const sharedSession = await sharedSessionRes.json();
    expect(sharedSession?.user?.activeOrganizationId).toBe(orgAId);

    // Reativar o vínculo do mesmo e-mail na Org B reativa o membership existente sem duplicar
    const reactivateRes = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: newAdminOrgBCookie,
      },
      body: JSON.stringify({
        email: sharedEmail,
        role: "APOIO",
      }),
    });
    expect(reactivateRes.status).toBe(201);
    const reactivated = await reactivateRes.json();
    expect(reactivated.membershipId).toBe(sharedUserOrgBMembershipId);
    expect(reactivated.role).toBe("APOIO");
    expect(reactivated.status).toBe("ACTIVE");
  });

  it("7. Impede deixar a congregação sem ADMIN ativo em PUT/PATCH/DELETE (409), considerando apenas activeOrganizationId", async () => {
    const newAdminOrgBCookie = await switchOrgInSession(
      await loginAndGetCookie(orgBNewAdminEmail, orgBNewAdminPassword),
      orgBId
    );

    // Neste momento Org B possui apenas 1 ADMIN ativo (orgBNewAdminMembershipId), embora Org A possua ADMIN próprio
    // 1. Próprio último ADMIN tentando se rebaixar via PUT -> 409
    const selfPutDemoteRes = await fetch(
      `${BASE_URL}/api/users/${orgBNewAdminMembershipId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: newAdminOrgBCookie,
        },
        body: JSON.stringify({ role: "DIRIGENTE" }),
      }
    );
    expect(selfPutDemoteRes.status).toBe(409);
    expect((await selfPutDemoteRes.json()).error).toBe(
      "Não é possível rebaixar o último administrador ativo desta congregação."
    );

    // 2. Global Admin em globalAdminMode tentando rebaixar último ADMIN da Org B via PATCH -> 409
    const globalPatchDemoteRes = await fetch(
      `${BASE_URL}/api/users/${orgBNewAdminMembershipId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: globalAdminOrgBCookie,
        },
        body: JSON.stringify({ role: "PROFESSOR" }),
      }
    );
    expect(globalPatchDemoteRes.status).toBe(409);

    // 3. Próprio último ADMIN pode atualizar seu nome mantendo role ADMIN -> 200
    const keepAdminRoleRes = await fetch(
      `${BASE_URL}/api/users/${orgBNewAdminMembershipId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: newAdminOrgBCookie,
        },
        body: JSON.stringify({
          name: `${TEST_PREFIX}Admin IV Dires Atualizado`,
          role: "ADMIN",
        }),
      }
    );
    expect(keepAdminRoleRes.status).toBe(200);

    // 4. DELETE do último ADMIN retorna 409 tanto para Global Admin quanto para auto-remoção
    const globalDeleteLastRes = await fetch(
      `${BASE_URL}/api/users/${orgBNewAdminMembershipId}`,
      {
        method: "DELETE",
        headers: { Cookie: globalAdminOrgBCookie },
      }
    );
    expect(globalDeleteLastRes.status).toBe(409);
    expect((await globalDeleteLastRes.json()).error).toBe(
      "Não é possível remover o último administrador ativo desta congregação."
    );

    const selfDeleteLastRes = await fetch(
      `${BASE_URL}/api/users/${orgBNewAdminMembershipId}`,
      {
        method: "DELETE",
        headers: { Cookie: newAdminOrgBCookie },
      }
    );
    expect(selfDeleteLastRes.status).toBe(409);

    const soleAdminStillActive = await prisma.organizationMembership.findUnique({
      where: { id: orgBNewAdminMembershipId },
    });
    expect(soleAdminStillActive?.status).toBe("ACTIVE");
    expect(soleAdminStillActive?.role).toBe("ADMIN");

    // 5. Promover sharedUser para segundo ADMIN em Org B libera remoção/rebaixamento do primeiro
    const promoteSecondRes = await fetch(
      `${BASE_URL}/api/users/${sharedUserOrgBMembershipId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: newAdminOrgBCookie,
        },
        body: JSON.stringify({ role: "ADMIN" }),
      }
    );
    expect(promoteSecondRes.status).toBe(200);

    // Agora com 2 ADMINs na Org B, rebaixar e depois remover o primeiro ADMIN funciona
    const demoteFirstNowRes = await fetch(
      `${BASE_URL}/api/users/${orgBNewAdminMembershipId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: globalAdminOrgBCookie,
        },
        body: JSON.stringify({ role: "PROFESSOR" }),
      }
    );
    expect(demoteFirstNowRes.status).toBe(200);
    expect((await demoteFirstNowRes.json()).role).toBe("PROFESSOR");

    // Promover novamente para ADMIN e testar remoção do primeiro via DELETE enquanto segundo continua ADMIN
    await fetch(`${BASE_URL}/api/users/${orgBNewAdminMembershipId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: globalAdminOrgBCookie,
      },
      body: JSON.stringify({ role: "ADMIN" }),
    });

    const removeFirstNowRes = await fetch(
      `${BASE_URL}/api/users/${orgBNewAdminMembershipId}`,
      {
        method: "DELETE",
        headers: { Cookie: globalAdminOrgBCookie },
      }
    );
    expect(removeFirstNowRes.status).toBe(200);

    // 6. Agora sharedUser voltou a ser o último ADMIN ativo da Org B e não pode ser rebaixado nem removido
    const sharedOrgBCookie = await switchOrgInSession(
      await loginAndGetCookie(sharedEmail, sharedOriginalPassword),
      orgBId
    );
    const sharedSelfDemoteRes = await fetch(
      `${BASE_URL}/api/users/${sharedUserOrgBMembershipId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: sharedOrgBCookie,
        },
        body: JSON.stringify({ role: "APOIO" }),
      }
    );
    expect(sharedSelfDemoteRes.status).toBe(409);

    const sharedDeleteBlockedRes = await fetch(
      `${BASE_URL}/api/users/${sharedUserOrgBMembershipId}`,
      {
        method: "DELETE",
        headers: { Cookie: globalAdminOrgBCookie },
      }
    );
    expect(sharedDeleteBlockedRes.status).toBe(409);

    const remainingAdminsOrgB = await prisma.organizationMembership.count({
      where: {
        organizationId: orgBId,
        status: "ACTIVE",
        role: "ADMIN",
      },
    });
    expect(remainingAdminsOrgB).toBe(1);
  });
});
