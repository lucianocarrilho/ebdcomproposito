import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const baseUrl = "http://localhost:3100";

// Group 1: Tracking Sets (used for afterEach transactional cleanup, cleared after cleanup)
const trackedCsaIds = new Set<string>();
const trackedMembershipIds = new Set<string>();
const trackedUserIds = new Set<string>();
const trackedClassIds = new Set<string>();
const trackedOrgIds = new Set<string>();

// Group 2: Audit Sets (never cleared, used in afterAll to detect any memory/db leaks)
const allCreatedCsaIds = new Set<string>();
const allCreatedMembershipIds = new Set<string>();
const allCreatedUserIds = new Set<string>();
const allCreatedClassIds = new Set<string>();
const allCreatedOrgIds = new Set<string>();

function registerOrg(id: string) {
  trackedOrgIds.add(id);
  allCreatedOrgIds.add(id);
  return id;
}

function registerUser(id: string) {
  trackedUserIds.add(id);
  allCreatedUserIds.add(id);
  return id;
}

function registerMembership(id: string) {
  trackedMembershipIds.add(id);
  allCreatedMembershipIds.add(id);
  return id;
}

function registerClass(id: string) {
  trackedClassIds.add(id);
  allCreatedClassIds.add(id);
  return id;
}

function registerCsa(id: string) {
  trackedCsaIds.add(id);
  allCreatedCsaIds.add(id);
  return id;
}

export async function cleanupTrackedIds() {
  const csaList = Array.from(trackedCsaIds);
  const memList = Array.from(trackedMembershipIds);
  const userList = Array.from(trackedUserIds);
  const classList = Array.from(trackedClassIds);
  const orgList = Array.from(trackedOrgIds);

  if (
    csaList.length === 0 &&
    memList.length === 0 &&
    userList.length === 0 &&
    classList.length === 0 &&
    orgList.length === 0
  ) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (csaList.length > 0) {
      await tx.classStaffAssignment.deleteMany({ where: { id: { in: csaList } } });
    }
    if (memList.length > 0) {
      await tx.organizationMembership.deleteMany({ where: { id: { in: memList } } });
    }
    if (userList.length > 0) {
      await tx.user.deleteMany({ where: { id: { in: userList } } });
    }
    if (classList.length > 0) {
      await tx.class.deleteMany({ where: { id: { in: classList } } });
    }
    if (orgList.length > 0) {
      await tx.organization.deleteMany({ where: { id: { in: orgList } } });
    }
  });

  trackedCsaIds.clear();
  trackedMembershipIds.clear();
  trackedUserIds.clear();
  trackedClassIds.clear();
  trackedOrgIds.clear();
}

/**
 * Creates a user and membership in targetOrgId, authenticates, and switches to activeOrganizationId.
 */
async function createUserAndLoginInOrg(targetOrgId: string, role: string = "PROFESSOR") {
  const testId = randomUUID();
  const email = `test_${testId}@test.com`;
  const password = "password123";

  // 1. Create User
  const user = await prisma.user.create({
    data: {
      name: `Test User ${testId}`,
      email,
      password: "dummy_password",
      active: true,
      role: role as any
    }
  });
  registerUser(user.id);

  const bcrypt = require("bcryptjs");
  const hashed = bcrypt.hashSync(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed }
  });

  // 2. Create Membership in targetOrgId
  const membership = await prisma.organizationMembership.create({
    data: {
      userId: user.id,
      organizationId: targetOrgId,
      role: role as any,
      status: "ACTIVE"
    }
  });
  registerMembership(membership.id);

  // 3. Authenticate with NextAuth
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  const cookies = csrfRes.headers.get("set-cookie") || "";
  const parsedCookies = cookies.split(",").map((c) => c.split(";")[0]).join("; ");

  const loginForm = new URLSearchParams();
  loginForm.append("email", email);
  loginForm.append("password", password);
  loginForm.append("csrfToken", csrfToken);
  loginForm.append("json", "true");

  const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: parsedCookies
    },
    body: loginForm.toString(),
    redirect: "manual"
  });

  const sessionCookies = loginRes.headers.get("set-cookie") || "";
  const finalCookies = `${parsedCookies}; ${sessionCookies.split(",").map((c) => c.split(";")[0]).join("; ")}`;

  // 4. Switch Session to targetOrgId
  const csrfRes2 = await fetch(`${baseUrl}/api/auth/csrf`, { headers: { Cookie: finalCookies } });
  const csrfData2 = await csrfRes2.json();
  const csrfToken2 = csrfData2.csrfToken;

  const switchRes = await fetch(`${baseUrl}/api/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: finalCookies
    },
    body: JSON.stringify({
      csrfToken: csrfToken2,
      data: { activeOrganizationId: targetOrgId }
    })
  });

  let activeCookies = finalCookies;
  if (switchRes.ok) {
    const swCookies = switchRes.headers.get("set-cookie") || "";
    const match = swCookies.match(/((?:__Secure-)?authjs\.session-token=[^;]+)/);
    if (match) {
      if (activeCookies.includes("authjs.session-token=")) {
        activeCookies = activeCookies.replace(/(?:__Secure-)?authjs\.session-token=[^;]+/, match[1]);
      } else {
        activeCookies = `${activeCookies}; ${match[1]}`;
      }
    }
  }

  return { user, membership, cookies: activeCookies, rawAuthCookies: finalCookies, testId };
}

describe("S3A: CSA Reads & Authorization", () => {
  let sedeOrg: any;
  let betelOrg: any;

  beforeEach(async () => {
    // Fresh isolated organizations created for each test
    const sedeId = randomUUID();
    sedeOrg = await prisma.organization.create({
      data: { name: "Sede Principal", slug: `sede-${sedeId}`, active: true }
    });
    registerOrg(sedeOrg.id);

    const betelId = randomUUID();
    betelOrg = await prisma.organization.create({
      data: { name: "Betel", slug: `betel-${betelId}`, active: true }
    });
    registerOrg(betelOrg.id);
  }, 60_000);

  afterEach(async () => {
    await cleanupTrackedIds();
  }, 60_000);

  afterAll(async () => {
    try {
      await cleanupTrackedIds();

      const csaAudit = Array.from(allCreatedCsaIds);
      const memAudit = Array.from(allCreatedMembershipIds);
      const userAudit = Array.from(allCreatedUserIds);
      const classAudit = Array.from(allCreatedClassIds);
      const orgAudit = Array.from(allCreatedOrgIds);

      const remCsa = csaAudit.length > 0 ? await prisma.classStaffAssignment.count({ where: { id: { in: csaAudit } } }) : 0;
      const remMem = memAudit.length > 0 ? await prisma.organizationMembership.count({ where: { id: { in: memAudit } } }) : 0;
      const remUser = userAudit.length > 0 ? await prisma.user.count({ where: { id: { in: userAudit } } }) : 0;
      const remClass = classAudit.length > 0 ? await prisma.class.count({ where: { id: { in: classAudit } } }) : 0;
      const remOrg = orgAudit.length > 0 ? await prisma.organization.count({ where: { id: { in: orgAudit } } }) : 0;

      const totalLeaks = remCsa + remMem + remUser + remClass + remOrg;
      if (totalLeaks > 0) {
        throw new Error(
          `LEAK_DETECTED: Total de ${totalLeaks} registros não foram limpos no banco _test (CSA:${remCsa}, Mem:${remMem}, User:${remUser}, Class:${remClass}, Org:${remOrg})`
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  }, 60_000);

  it("1. Professor com CSA ativo retorna apenas as turmas atribuídas no CSA", async () => {
    const profUser = await createUserAndLoginInOrg(sedeOrg.id, "PROFESSOR");

    const cls = await prisma.class.create({
      data: { name: `Class Prof CSA ${profUser.testId}`, organizationId: sedeOrg.id, status: true }
    });
    registerClass(cls.id);

    const csa = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sedeOrg.id,
        classId: cls.id,
        organizationMembershipId: profUser.membership.id,
        assignmentRole: "PROFESSOR",
        active: true
      }
    });
    registerCsa(csa.id);

    const res = await fetch(`${baseUrl}/api/classes`, {
      headers: { Cookie: profUser.cookies }
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((c: any) => c.id === cls.id)).toBe(true);
  });

  it("2. Professor sem CSA e com classId legado recebe lista vazia []", async () => {
    const clsLegada = await prisma.class.create({
      data: { name: `Class Legada ${randomUUID()}`, organizationId: sedeOrg.id, status: true }
    });
    registerClass(clsLegada.id);

    const profUser = await createUserAndLoginInOrg(sedeOrg.id, "PROFESSOR");
    await prisma.user.update({
      where: { id: profUser.user.id },
      data: { classId: clsLegada.id }
    });

    const res = await fetch(`${baseUrl}/api/classes`, {
      headers: { Cookie: profUser.cookies }
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  it("3. CSA inativo (active = false) retorna lista vazia []", async () => {
    const profUser = await createUserAndLoginInOrg(sedeOrg.id, "PROFESSOR");

    const cls = await prisma.class.create({
      data: { name: `Class CSA Inativa ${profUser.testId}`, organizationId: sedeOrg.id, status: true }
    });
    registerClass(cls.id);

    const csa = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sedeOrg.id,
        classId: cls.id,
        organizationMembershipId: profUser.membership.id,
        assignmentRole: "PROFESSOR",
        active: false // Inactive CSA assignment
      }
    });
    registerCsa(csa.id);

    const res = await fetch(`${baseUrl}/api/classes`, {
      headers: { Cookie: profUser.cookies }
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((c: any) => c.id === cls.id)).toBe(false);
  });

  it("4. Membership inativa (status != 'ACTIVE') rejeita acesso com HTTP 403", async () => {
    const profUser = await createUserAndLoginInOrg(sedeOrg.id, "PROFESSOR");

    await prisma.organizationMembership.update({
      where: { id: profUser.membership.id },
      data: { status: "INACTIVE" }
    });

    const res = await fetch(`${baseUrl}/api/classes`, {
      headers: { Cookie: profUser.cookies }
    });

    expect(res.status).toBe(403);
  });

  it("5. Assignment PROFESSOR em ClassAssignmentRole autoriza leitura da turma", async () => {
    const profUser = await createUserAndLoginInOrg(sedeOrg.id, "PROFESSOR");

    const cls = await prisma.class.create({
      data: { name: `Class Assign PROF ${profUser.testId}`, organizationId: sedeOrg.id, status: true }
    });
    registerClass(cls.id);

    const csa = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sedeOrg.id,
        classId: cls.id,
        organizationMembershipId: profUser.membership.id,
        assignmentRole: "PROFESSOR",
        active: true
      }
    });
    registerCsa(csa.id);

    const res = await fetch(`${baseUrl}/api/classes`, {
      headers: { Cookie: profUser.cookies }
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((c: any) => c.id === cls.id)).toBe(true);
  });

  it("6. Assignment AUXILIAR em ClassAssignmentRole autoriza leitura da turma", async () => {
    const profUser = await createUserAndLoginInOrg(sedeOrg.id, "PROFESSOR");

    const cls = await prisma.class.create({
      data: { name: `Class Assign AUX ${profUser.testId}`, organizationId: sedeOrg.id, status: true }
    });
    registerClass(cls.id);

    const csa = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sedeOrg.id,
        classId: cls.id,
        organizationMembershipId: profUser.membership.id,
        assignmentRole: "AUXILIAR", // ClassAssignmentRole AUXILIAR
        active: true
      }
    });
    registerCsa(csa.id);

    const res = await fetch(`${baseUrl}/api/classes`, {
      headers: { Cookie: profUser.cookies }
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((c: any) => c.id === cls.id)).toBe(true);
  });

  it("7. Duas congregações isoladas (membro bilateral): enxerga apenas turmas da congregação selecionada", async () => {
    const profUserSede = await createUserAndLoginInOrg(sedeOrg.id, "PROFESSOR");

    // Create valid Membership B for same user in betelOrg
    const memBetel = await prisma.organizationMembership.create({
      data: { userId: profUserSede.user.id, organizationId: betelOrg.id, role: "PROFESSOR", status: "ACTIVE" }
    });
    registerMembership(memBetel.id);

    // Create Class A in sedeOrg and Class B in betelOrg
    const clsSede = await prisma.class.create({
      data: { name: `Class Sede Bi ${profUserSede.testId}`, organizationId: sedeOrg.id, status: true }
    });
    registerClass(clsSede.id);

    const clsBetel = await prisma.class.create({
      data: { name: `Class Betel Bi ${profUserSede.testId}`, organizationId: betelOrg.id, status: true }
    });
    registerClass(clsBetel.id);

    // CSA A: Class A + Membership A + sedeOrg.id
    const csaSede = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sedeOrg.id,
        classId: clsSede.id,
        organizationMembershipId: profUserSede.membership.id,
        assignmentRole: "PROFESSOR",
        active: true
      }
    });
    registerCsa(csaSede.id);

    // CSA B: Class B + Membership B + betelOrg.id
    const csaBetel = await prisma.classStaffAssignment.create({
      data: {
        organizationId: betelOrg.id,
        classId: clsBetel.id,
        organizationMembershipId: memBetel.id,
        assignmentRole: "PROFESSOR",
        active: true
      }
    });
    registerCsa(csaBetel.id);

    // Authenticate session selecting Org A (sedeOrg.id)
    const resSede = await fetch(`${baseUrl}/api/classes`, {
      headers: { Cookie: profUserSede.cookies }
    });

    expect(resSede.status).toBe(200);
    const dataSede = await resSede.json();
    expect(dataSede.some((c: any) => c.id === clsSede.id)).toBe(true);
    expect(dataSede.some((c: any) => c.id === clsBetel.id)).toBe(false);
  });

  it("8. Tentativa com Membership de outra organização não retorna turmas da outra organização", async () => {
    const profSede = await createUserAndLoginInOrg(sedeOrg.id, "PROFESSOR");

    const clsBetel = await prisma.class.create({
      data: { name: `Class Betel Exclu ${profSede.testId}`, organizationId: betelOrg.id, status: true }
    });
    registerClass(clsBetel.id);

    // Query in sedeOrg should never return betelOrg class
    const res = await fetch(`${baseUrl}/api/classes`, {
      headers: { Cookie: profSede.cookies }
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((c: any) => c.id === clsBetel.id)).toBe(false);
  });

  it("9. Classe inativa (status = false) é filtrada do resultado final", async () => {
    const profUser = await createUserAndLoginInOrg(sedeOrg.id, "PROFESSOR");

    const clsInativa = await prisma.class.create({
      data: { name: `Class Inativa ${profUser.testId}`, organizationId: sedeOrg.id, status: false }
    });
    registerClass(clsInativa.id);

    const csa = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sedeOrg.id,
        classId: clsInativa.id,
        organizationMembershipId: profUser.membership.id,
        assignmentRole: "PROFESSOR",
        active: true
      }
    });
    registerCsa(csa.id);

    const res = await fetch(`${baseUrl}/api/classes`, {
      headers: { Cookie: profUser.cookies }
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((c: any) => c.id === clsInativa.id)).toBe(false);
  });

  it("10. Perfis ADMIN / DIRIGENTE / VICE_DIRIGENTE em Role retornam todas as turmas ativas da congregação", async () => {
    const fullAccessRoles = ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE"];

    for (const role of fullAccessRoles) {
      const userObj = await createUserAndLoginInOrg(sedeOrg.id, role);

      const cls = await prisma.class.create({
        data: { name: `Class Role ${role} ${userObj.testId}`, organizationId: sedeOrg.id, status: true }
      });
      registerClass(cls.id);

      const res = await fetch(`${baseUrl}/api/classes`, {
        headers: { Cookie: userObj.cookies }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.some((c: any) => c.id === cls.id)).toBe(true);
    }
  });

  it("11. Global Admin com organização selecionada retorna todas as turmas ativas daquela organização", async () => {
    const testId = randomUUID();
    const globalAdmin = await prisma.user.create({
      data: {
        name: `Global Admin ${testId}`,
        email: `global_${testId}@test.com`,
        password: "dummy_password",
        isGlobalAdmin: true,
        active: true
      }
    });
    registerUser(globalAdmin.id);

    const bcrypt = require("bcryptjs");
    const hashed = bcrypt.hashSync("password123", 10);
    await prisma.user.update({ where: { id: globalAdmin.id }, data: { password: hashed } });

    // Authenticate and switch session to sedeOrg.id
    const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
    const csrfData = await csrfRes.json();
    const cookies = csrfRes.headers.get("set-cookie") || "";
    const parsedCookies = cookies.split(",").map((c) => c.split(";")[0]).join("; ");

    const loginForm = new URLSearchParams();
    loginForm.append("email", globalAdmin.email);
    loginForm.append("password", "password123");
    loginForm.append("csrfToken", csrfData.csrfToken);
    loginForm.append("json", "true");

    const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: parsedCookies },
      body: loginForm.toString(),
      redirect: "manual"
    });

    const sessionCookies = loginRes.headers.get("set-cookie") || "";
    const finalCookies = `${parsedCookies}; ${sessionCookies.split(",").map((c) => c.split(";")[0]).join("; ")}`;

    const csrfRes2 = await fetch(`${baseUrl}/api/auth/csrf`, { headers: { Cookie: finalCookies } });
    const csrfData2 = await csrfRes2.json();

    const switchRes = await fetch(`${baseUrl}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: finalCookies },
      body: JSON.stringify({
        csrfToken: csrfData2.csrfToken,
        data: { activeOrganizationId: sedeOrg.id }
      })
    });

    let adminCookies = finalCookies;
    if (switchRes.ok) {
      const swCookies = switchRes.headers.get("set-cookie") || "";
      const match = swCookies.match(/((?:__Secure-)?authjs\.session-token=[^;]+)/);
      if (match) {
        if (adminCookies.includes("authjs.session-token=")) {
          adminCookies = adminCookies.replace(/(?:__Secure-)?authjs\.session-token=[^;]+/, match[1]);
        } else {
          adminCookies = `${adminCookies}; ${match[1]}`;
        }
      }
    }

    const cls = await prisma.class.create({
      data: { name: `Class GlobalAdmin ${testId}`, organizationId: sedeOrg.id, status: true }
    });
    registerClass(cls.id);

    const res = await fetch(`${baseUrl}/api/classes`, {
      headers: { Cookie: adminCookies }
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((c: any) => c.id === cls.id)).toBe(true);
  });

  it("12. Usuário autenticado sem organização ativa recebe HTTP 403 Organização não selecionada", async () => {
    // Authenticated user with valid membership, but session NOT switched to any organization
    const profUserNoOrg = await createUserAndLoginInOrg(sedeOrg.id, "PROFESSOR");

    // Use rawAuthCookies from step 3 (credentials login) without step 4 (activeOrganizationId switch)
    const resNoActiveOrg = await fetch(`${baseUrl}/api/classes`, {
      headers: { Cookie: profUserNoOrg.rawAuthCookies }
    });

    expect(resNoActiveOrg.status).toBe(403);
    const body = await resNoActiveOrg.json();
    expect(body.error).toBe("Organização não selecionada");
  });
});
