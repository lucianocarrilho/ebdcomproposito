import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3100";

const suiteRunId = randomUUID();

// Collections de audit/tracking
const trackedOrgIds = new Set<string>();
const trackedClassIds = new Set<string>();
const trackedStudentIds = new Set<string>();
const trackedUserIds = new Set<string>();
const trackedMembershipIds = new Set<string>();
const trackedCsaIds = new Set<string>();
const trackedJustificationIds = new Set<string>();
const trackedLessonIds = new Set<string>();
const trackedNotificationIds = new Set<string>();
const trackedAttendanceRecordIds = new Set<string>();

const allCreatedOrgIds = new Set<string>();
const allCreatedClassIds = new Set<string>();
const allCreatedStudentIds = new Set<string>();
const allCreatedUserIds = new Set<string>();
const allCreatedMembershipIds = new Set<string>();
const allCreatedCsaIds = new Set<string>();
const allCreatedJustificationIds = new Set<string>();
const allCreatedLessonIds = new Set<string>();
const allCreatedNotificationIds = new Set<string>();
const allCreatedAttendanceRecordIds = new Set<string>();

function registerOrg(id: string) {
  trackedOrgIds.add(id);
  allCreatedOrgIds.add(id);
  return id;
}
function registerClass(id: string) {
  trackedClassIds.add(id);
  allCreatedClassIds.add(id);
  return id;
}
function registerStudent(id: string) {
  trackedStudentIds.add(id);
  allCreatedStudentIds.add(id);
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
function registerCsa(id: string) {
  trackedCsaIds.add(id);
  allCreatedCsaIds.add(id);
  return id;
}
function registerJustification(id: string) {
  trackedJustificationIds.add(id);
  allCreatedJustificationIds.add(id);
  return id;
}
function registerLesson(id: string) {
  trackedLessonIds.add(id);
  allCreatedLessonIds.add(id);
  return id;
}
function registerNotification(id: string) {
  trackedNotificationIds.add(id);
  allCreatedNotificationIds.add(id);
  return id;
}
function registerAttendanceRecord(id: string) {
  trackedAttendanceRecordIds.add(id);
  allCreatedAttendanceRecordIds.add(id);
  return id;
}

// Helpers de login e cookie session

/**
 * Combina um header Cookie existente com os cookies de um header Set-Cookie,
 * devolvendo um header Cookie normalizado.
 *
 * - Extrai apenas pares nome=valor, descartando atributos (Path, HttpOnly,
 *   SameSite, Expires, Max-Age, Domain, Secure).
 * - A separação por vírgula ocorre somente quando a vírgula inicia um novo par,
 *   preservando datas como "Expires=Thu, 01 Jan 1970 00:00:00 GMT".
 * - Pares repetidos mantêm o último valor recebido, de modo que um
 *   authjs.session-token atualizado substitui apenas o valor anterior do mesmo
 *   cookie, preservando authjs.csrf-token e os demais pares.
 */
function mergeCookies(currentCookieHeader: string, setCookieHeader: string): string {
  const jar = new Map<string, string>();

  const addPair = (rawPair: string): void => {
    const pair = rawPair.trim();
    const separator = pair.indexOf("=");
    if (separator <= 0) return;
    jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  };

  currentCookieHeader.split(";").forEach(addPair);

  setCookieHeader
    .split(/,(?=\s*[^;=,\s]+=)/)
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => /^\s*[^=\s]+=/.test(pair))
    .forEach(addPair);

  const normalized: string[] = [];
  jar.forEach((value, name) => {
    normalized.push(`${name}=${value}`);
  });
  return normalized.join("; ");
}

async function loginAndGetCookie(email: string, password = "password123"): Promise<string> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookie = mergeCookies("", csrfRes.headers.get("set-cookie") || "");

  const params = new URLSearchParams();
  params.append("csrfToken", csrfToken);
  params.append("email", email);
  params.append("password", password);

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookie,
    },
    body: params.toString(),
    redirect: "manual",
  });

  return mergeCookies(csrfCookie, loginRes.headers.get("set-cookie") || "");
}

async function createUserAndLoginInOrg(
  emailPrefix: string,
  role: "ADMIN" | "DIRIGENTE" | "VICE_DIRIGENTE" | "PROFESSOR" | "APOIO",
  orgId: string,
  options?: { isGlobalAdmin?: boolean; membershipStatus?: "ACTIVE" | "INACTIVE" }
) {
  const bcrypt = require("bcryptjs");
  const hashed = bcrypt.hashSync("password123", 10);
  const uniqueId = randomUUID();
  const user = await prisma.user.create({
    data: {
      name: `User ${emailPrefix}`,
      email: `${emailPrefix}_s3b1_${suiteRunId}_${uniqueId}@test.com`,
      password: hashed,
      role,
      isGlobalAdmin: options?.isGlobalAdmin || false,
    },
  });
  registerUser(user.id);

  const membership = await prisma.organizationMembership.create({
    data: {
      userId: user.id,
      organizationId: orgId,
      role,
      status: options?.membershipStatus || "ACTIVE",
    },
  });
  registerMembership(membership.id);

  const cookie = await loginAndGetCookie(user.email);
  return { user, membership, cookie };
}

async function switchOrgInSession(cookie: string, orgId: string): Promise<string> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`, { headers: { Cookie: cookie } });
  const { csrfToken } = await csrfRes.json();
  const cookieWithCsrf = mergeCookies(cookie, csrfRes.headers.get("set-cookie") || "");

  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieWithCsrf,
    },
    body: JSON.stringify({
      csrfToken,
      data: { activeOrganizationId: orgId },
    }),
  });

  return mergeCookies(cookieWithCsrf, sessionRes.headers.get("set-cookie") || "");
}

// Fixtures Base
let orgA: any, orgB: any;
let classA: any, classB: any;
let studentA: any, studentB: any;
let adminAUser: any, adminACookie: string;
let dirigenteAUser: any, dirigenteACookie: string;
let viceDirigenteAUser: any, viceDirigenteACookie: string;
let professorAUser: any, professorAMembership: any, professorACookie: string;
let apoioAUser: any, apoioAMembership: any, apoioACookie: string;
let userSemCSA: any, userSemCSACookie: string;
let userMemberOrgB: any, userMemberOrgBCookie: string;
let globalAdminUser: any, globalAdminCookie: string;
let professorACSA: any, apoioACSA: any;

describe("Fase S3B.1 — Operational Writes Isolation & Multi-Tenant Authorization (48 Tests)", () => {
  beforeAll(async () => {
    // 1. Criar Organizações A e B
    orgA = await prisma.organization.create({
      data: { name: "S3B1 Org A", slug: `s3b1-${suiteRunId}-org-a`, active: true }
    });
    registerOrg(orgA.id);

    orgB = await prisma.organization.create({
      data: { name: "S3B1 Org B", slug: `s3b1-${suiteRunId}-org-b`, active: true }
    });
    registerOrg(orgB.id);

    // 2. Criar Turmas
    classA = await prisma.class.create({
      data: { name: "Adultos OrgA", organizationId: orgA.id, status: true }
    });
    registerClass(classA.id);

    classB = await prisma.class.create({
      data: { name: "Adultos OrgB", organizationId: orgB.id, status: true }
    });
    registerClass(classB.id);

    // 3. Criar Estudantes
    studentA = await prisma.student.create({
      data: { name: "Aluno OrgA", classId: classA.id, organizationId: orgA.id, active: true }
    });
    registerStudent(studentA.id);

    studentB = await prisma.student.create({
      data: { name: "Aluno OrgB", classId: classB.id, organizationId: orgB.id, active: true }
    });
    registerStudent(studentB.id);

    // 4. Criar Usuários Base
    const resAdmin = await createUserAndLoginInOrg("admin_a", "ADMIN", orgA.id);
    adminAUser = resAdmin.user;
    adminACookie = resAdmin.cookie;

    const resDirigente = await createUserAndLoginInOrg("dirigente_a", "DIRIGENTE", orgA.id);
    dirigenteAUser = resDirigente.user;
    dirigenteACookie = resDirigente.cookie;

    const resVice = await createUserAndLoginInOrg("vice_dirigente_a", "VICE_DIRIGENTE", orgA.id);
    viceDirigenteAUser = resVice.user;
    viceDirigenteACookie = resVice.cookie;

    const resProf = await createUserAndLoginInOrg("professor_a", "PROFESSOR", orgA.id);
    professorAUser = resProf.user;
    professorAMembership = resProf.membership;
    professorACookie = resProf.cookie;

    const resApoio = await createUserAndLoginInOrg("apoio_a", "APOIO", orgA.id);
    apoioAUser = resApoio.user;
    apoioAMembership = resApoio.membership;
    apoioACookie = resApoio.cookie;

    const resSemCSA = await createUserAndLoginInOrg("user_sem_csa", "PROFESSOR", orgA.id);
    userSemCSA = resSemCSA.user;
    userSemCSACookie = resSemCSA.cookie;

    const resOrgB = await createUserAndLoginInOrg("user_org_b", "PROFESSOR", orgB.id);
    userMemberOrgB = resOrgB.user;
    userMemberOrgBCookie = resOrgB.cookie;

    const idGlobal = randomUUID();
    globalAdminUser = await prisma.user.create({
      data: {
        name: "Global Admin S3B1",
        email: `global_s3b1_${suiteRunId}_${idGlobal}@test.com`,
        password: "hash",
        role: "ADMIN",
        isGlobalAdmin: true,
      }
    });
    registerUser(globalAdminUser.id);
    const bcrypt = require("bcryptjs");
    const hashed = bcrypt.hashSync("password123", 10);
    await prisma.user.updateMany({
      where: { id: { in: [adminAUser.id, dirigenteAUser.id, viceDirigenteAUser.id, professorAUser.id, apoioAUser.id, userSemCSA.id, userMemberOrgB.id, globalAdminUser.id] } },
      data: { password: hashed }
    });
    globalAdminCookie = await loginAndGetCookie(globalAdminUser.email);

    // 5. Atribuir CSAs
    professorACSA = await prisma.classStaffAssignment.create({
      data: {
        organizationId: orgA.id,
        classId: classA.id,
        organizationMembershipId: professorAMembership.id,
        assignmentRole: "PROFESSOR",
        active: true,
      }
    });
    registerCsa(professorACSA.id);

    apoioACSA = await prisma.classStaffAssignment.create({
      data: {
        organizationId: orgA.id,
        classId: classA.id,
        organizationMembershipId: apoioAMembership.id,
        assignmentRole: "AUXILIAR",
        active: true,
      }
    });
    registerCsa(apoioACSA.id);

    // Limpar exclusivamente os Sets correntes ao finalizar o beforeAll, preservando allCreated* integralmente
    trackedOrgIds.clear();
    trackedClassIds.clear();
    trackedStudentIds.clear();
    trackedUserIds.clear();
    trackedMembershipIds.clear();
    trackedCsaIds.clear();
    trackedJustificationIds.clear();
    trackedLessonIds.clear();
    trackedNotificationIds.clear();
    trackedAttendanceRecordIds.clear();
  }, 60_000);

  afterEach(async () => {
    const justList = Array.from(trackedJustificationIds);
    const attList = Array.from(trackedAttendanceRecordIds);
    const notifList = Array.from(trackedNotificationIds);
    const lessonList = Array.from(trackedLessonIds);
    const csaList = Array.from(trackedCsaIds);
    const studList = Array.from(trackedStudentIds);
    const classList = Array.from(trackedClassIds);
    const memList = Array.from(trackedMembershipIds);
    const userList = Array.from(trackedUserIds);
    const orgList = Array.from(trackedOrgIds);

    // Exclusões sequenciais diretas em auto-commit sem wrapper $transaction para evitar deadlocks MySQL
    if (justList.length > 0) {
      await prisma.absenceJustification.deleteMany({ where: { id: { in: justList } } });
    }
    if (attList.length > 0) {
      await prisma.attendanceItem.deleteMany({ where: { recordId: { in: attList } } });
      await prisma.attendanceRecord.deleteMany({ where: { id: { in: attList } } });
    }
    if (notifList.length > 0) {
      await prisma.notificationRead.deleteMany({ where: { notificationId: { in: notifList } } });
      await prisma.notification.deleteMany({ where: { id: { in: notifList } } });
    }
    if (lessonList.length > 0) {
      await prisma.lesson.deleteMany({ where: { id: { in: lessonList } } });
    }
    if (csaList.length > 0) {
      await prisma.classStaffAssignment.deleteMany({ where: { id: { in: csaList } } });
    }
    if (studList.length > 0) {
      await prisma.student.deleteMany({ where: { id: { in: studList } } });
    }
    if (classList.length > 0) {
      await prisma.class.deleteMany({ where: { id: { in: classList } } });
    }
    if (memList.length > 0) {
      await prisma.organizationMembership.deleteMany({ where: { id: { in: memList } } });
    }
    if (userList.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userList } } });
    }
    if (orgList.length > 0) {
      await prisma.organization.deleteMany({ where: { id: { in: orgList } } });
    }

    trackedJustificationIds.clear();
    trackedAttendanceRecordIds.clear();
    trackedNotificationIds.clear();
    trackedLessonIds.clear();
    trackedCsaIds.clear();
    trackedStudentIds.clear();
    trackedClassIds.clear();
    trackedMembershipIds.clear();
    trackedUserIds.clear();
    trackedOrgIds.clear();
  });

  afterAll(async () => {
    try {
      const justList = Array.from(allCreatedJustificationIds);
      const attList = Array.from(allCreatedAttendanceRecordIds);
      const notifList = Array.from(allCreatedNotificationIds);
      const lessonList = Array.from(allCreatedLessonIds);
      const csaList = Array.from(allCreatedCsaIds);
      const studList = Array.from(allCreatedStudentIds);
      const classList = Array.from(allCreatedClassIds);
      const memList = Array.from(allCreatedMembershipIds);
      const userList = Array.from(allCreatedUserIds);
      const orgList = Array.from(allCreatedOrgIds);

      // Exclusões sequenciais diretas em auto-commit sem wrapper $transaction para evitar deadlocks MySQL
      if (justList.length > 0) {
        await prisma.absenceJustification.deleteMany({ where: { id: { in: justList } } });
      }
      if (attList.length > 0) {
        await prisma.attendanceItem.deleteMany({ where: { recordId: { in: attList } } });
        await prisma.attendanceRecord.deleteMany({ where: { id: { in: attList } } });
      }
      if (notifList.length > 0) {
        await prisma.notificationRead.deleteMany({ where: { notificationId: { in: notifList } } });
        await prisma.notification.deleteMany({ where: { id: { in: notifList } } });
      }
      if (lessonList.length > 0) {
        await prisma.lesson.deleteMany({ where: { id: { in: lessonList } } });
      }
      if (csaList.length > 0) {
        await prisma.classStaffAssignment.deleteMany({ where: { id: { in: csaList } } });
      }
      if (studList.length > 0) {
        await prisma.student.deleteMany({ where: { id: { in: studList } } });
      }
      if (memList.length > 0) {
        await prisma.organizationMembership.deleteMany({ where: { id: { in: memList } } });
      }
      if (userList.length > 0) {
        await prisma.user.updateMany({ where: { id: { in: userList } }, data: { classId: null } });
        await prisma.user.deleteMany({ where: { id: { in: userList } } });
      }
      if (classList.length > 0) {
        await prisma.class.deleteMany({ where: { id: { in: classList } } });
      }
      if (orgList.length > 0) {
        await prisma.organization.deleteMany({ where: { id: { in: orgList } } });
      }

      console.log("[AFTER_ALL_CLEANUP_EXECUTED]");

      // Assertiva independente de contagem residual dos IDs do Set permanente
      const remJust = await prisma.absenceJustification.count({ where: { id: { in: justList } } });
      const remAtt = await prisma.attendanceRecord.count({ where: { id: { in: attList } } });
      const remNotif = await prisma.notification.count({ where: { id: { in: notifList } } });
      const remLesson = await prisma.lesson.count({ where: { id: { in: lessonList } } });
      const remCsa = await prisma.classStaffAssignment.count({ where: { id: { in: csaList } } });
      const remStud = await prisma.student.count({ where: { id: { in: studList } } });
      const remClass = await prisma.class.count({ where: { id: { in: classList } } });
      const remMem = await prisma.organizationMembership.count({ where: { id: { in: memList } } });
      const remUser = await prisma.user.count({ where: { id: { in: userList } } });
      const remOrg = await prisma.organization.count({ where: { id: { in: orgList } } });

      const totalTrackedRemaining = remJust + remAtt + remNotif + remLesson + remCsa + remStud + remClass + remMem + remUser + remOrg;
      console.log(`[S3B1_TRACKED_REMAINING: ${totalTrackedRemaining}]`);

      // Auditoria de Namespace do Teste
      const remNamespaceOrgs = await prisma.organization.count({ where: { slug: { contains: suiteRunId } } });
      console.log(`[S3B1_NAMESPACE_REMAINING: ${remNamespaceOrgs}]`);

      if (totalTrackedRemaining > 0 || remNamespaceOrgs > 0) {
        throw new Error(`LEAK_DETECTED_NAMESPACE: ${totalTrackedRemaining} IDs rastreados e ${remNamespaceOrgs} orgs de namespace ainda existem no DB.`);
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  // --- SUBGRUPO 1: Justificativas & Presença (Tests 1-12, 41-45, 48) ---
  it("1. ADMIN/DIRIGENTE cria justificativa via POST /api/justifications", async () => {
    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/justifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        studentId: studentA.id,
        date: "2026-03-01",
        reason: "Viagem em família",
        observations: "Obs admin",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    registerJustification(data.id);
    expect(data.organizationId).toBe(orgA.id);
    expect(data.registeredById).toBe(adminAUser.id);
  });

  it("2. VICE_DIRIGENTE cria justificativa para aluno da congregação ativa", async () => {
    const cookie = await switchOrgInSession(viceDirigenteACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/justifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        studentId: studentA.id,
        date: "2026-03-02",
        reason: "Trabalho",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    registerJustification(data.id);
    expect(data.organizationId).toBe(orgA.id);
  });

  it("3. Global Admin com congregação selecionada cria justificativa para aluno da congregação ativa", async () => {
    const cookie = await switchOrgInSession(globalAdminCookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/justifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        studentId: studentA.id,
        date: "2026-03-03",
        reason: "Saúde",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    registerJustification(data.id);
    expect(data.organizationId).toBe(orgA.id);
  });

  it("4. PROFESSOR com CSA ativo cria justificativa para aluno da sua turma", async () => {
    const cookie = await switchOrgInSession(professorACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/justifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        studentId: studentA.id,
        date: "2026-03-04",
        reason: "Consulta médica",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    registerJustification(data.id);
    expect(data.organizationId).toBe(orgA.id);
  });

  it("5. PROFESSOR tenta criar justificativa para aluno de outra turma da mesma congregação", async () => {
    const outraClass = await prisma.class.create({
      data: { name: "Jovens OrgA", organizationId: orgA.id, status: true },
    });
    registerClass(outraClass.id);

    const outroStudent = await prisma.student.create({
      data: { name: "Aluno Outra Turma", classId: outraClass.id, organizationId: orgA.id, active: true },
    });
    registerStudent(outroStudent.id);

    const cookie = await switchOrgInSession(professorACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/justifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        studentId: outroStudent.id,
        date: "2026-03-05",
        reason: "Invalido",
      }),
    });
    expect(res.status).toBe(403);
  });

  it("6. PROFESSOR sem CSA ativo tenta criar justificativa", async () => {
    const cookie = await switchOrgInSession(userSemCSACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/justifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        studentId: studentA.id,
        date: "2026-03-06",
        reason: "Sem CSA",
      }),
    });
    expect(res.status).toBe(403);
  });

  it("7. Tentativa de criar justificativa enviando studentId de outra congregação retorna HTTP 404", async () => {
    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/justifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        studentId: studentB.id,
        date: "2026-03-07",
        reason: "Outra Org",
      }),
    });
    expect(res.status).toBe(404);
  });

  it("8. Chamada POST /api/attendance auto-cria AbsenceJustification com organizationId da congregação ativa para FALTA_JUSTIFICADA", async () => {
    const cookie = await switchOrgInSession(professorACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        classId: classA.id,
        date: "2026-03-08",
        items: [
          { studentId: studentA.id, status: "FALTA_JUSTIFICADA", observations: "Justificada em lote" },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    registerAttendanceRecord(data.recordId);

    const just = await prisma.absenceJustification.findFirst({
      where: { studentId: studentA.id, date: new Date("2026-03-08T00:00:00.000Z") },
    });
    expect(just).not.toBeNull();
    registerJustification(just!.id);
    expect(just?.organizationId).toBe(orgA.id);
    expect(just?.registeredById).toBe(professorAUser.id);
  });

  it("9. Chamada POST /api/attendance enviando classId de outra congregação é bloqueada com HTTP 404", async () => {
    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        classId: classB.id,
        date: "2026-03-09",
        items: [{ studentId: studentB.id, status: "PRESENTE" }],
      }),
    });
    expect(res.status).toBe(404);
  });

  it("10. Ausência de activeOrganizationId em justificativa e chamada de presença retorna HTTP 403", async () => {
    const cookieWithoutOrg = adminACookie; // cookie sem selecionar org no session
    const resJust = await fetch(`${BASE_URL}/api/justifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieWithoutOrg },
      body: JSON.stringify({ studentId: studentA.id, date: "2026-03-10", reason: "Sem Org" }),
    });
    expect(resJust.status).toBe(403);

    const resAtt = await fetch(`${BASE_URL}/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieWithoutOrg },
      body: JSON.stringify({ classId: classA.id, date: "2026-03-10", items: [] }),
    });
    expect(resAtt.status).toBe(403);
  });

  it("11. Membership inativa em justificativa e chamada de presença retorna HTTP 403", async () => {
    const { cookie: inactiveCookie } = await createUserAndLoginInOrg("inactive_user", "ADMIN", orgA.id, {
      membershipStatus: "INACTIVE",
    });
    const cookieWithOrg = await switchOrgInSession(inactiveCookie, orgA.id);

    const resJust = await fetch(`${BASE_URL}/api/justifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieWithOrg },
      body: JSON.stringify({ studentId: studentA.id, date: "2026-03-11", reason: "Inativo" }),
    });
    expect(resJust.status).toBe(403);

    const resAtt = await fetch(`${BASE_URL}/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieWithOrg },
      body: JSON.stringify({ classId: classA.id, date: "2026-03-11", items: [] }),
    });
    expect(resAtt.status).toBe(403);
  });

  it("12. Autenticação ausente em justificativa e chamada de presença retorna HTTP 401", async () => {
    const resJust = await fetch(`${BASE_URL}/api/justifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: studentA.id, date: "2026-03-12", reason: "Anon" }),
    });
    expect(resJust.status).toBe(401);

    const resAtt = await fetch(`${BASE_URL}/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: classA.id, date: "2026-03-12", items: [] }),
    });
    expect(resAtt.status).toBe(401);
  });

  // --- SUBGRUPO 2: Lições (POST, PUT, DELETE) (Tests 13-27, 46) ---
  it("13. Gestor (ADMIN/DIRIGENTE/VICE_DIRIGENTE) cria lição no POST /api/lessons", async () => {
    const cookie = await switchOrgInSession(dirigenteACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        number: 1,
        title: "Lição 1 Admin",
        quarter: "2026-Q1",
        category: "Adultos",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    registerLesson(data.id);
    expect(data.organizationId).toBe(orgA.id);
  });

  it("14. Global Admin com congregação selecionada cria lição na congregação ativa", async () => {
    const cookie = await switchOrgInSession(globalAdminCookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        number: 2,
        title: "Lição 2 Global",
        quarter: "2026-Q1",
        category: "Adultos",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    registerLesson(data.id);
    expect(data.organizationId).toBe(orgA.id);
  });

  it("15. PROFESSOR com CSA cria lição para categoria de turma atribuída", async () => {
    const cookie = await switchOrgInSession(professorACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        number: 3,
        title: "Lição 3 Prof",
        quarter: "2026-Q1",
        category: "Adultos OrgA", // bate com classA.name
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    registerLesson(data.id);
    expect(data.organizationId).toBe(orgA.id);
  });

  it("16. PROFESSOR tenta criar lição para categoria não atribuída", async () => {
    const cookie = await switchOrgInSession(professorACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        number: 4,
        title: "Lição 4 Prof Negada",
        quarter: "2026-Q1",
        category: "Jovens NaoAtribuida",
      }),
    });
    expect(res.status).toBe(403);
  });

  it("17. Injeção de organizationId no payload de POST /api/lessons é rejeitada com HTTP 400", async () => {
    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        number: 5,
        title: "Lição Injeção",
        quarter: "2026-Q1",
        category: "Adultos",
        organizationId: orgB.id,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("18. Gestor edita lição via PUT /api/lessons/[id] alterando quarter e category para valores autorizados", async () => {
    const lesson = await prisma.lesson.create({
      data: { number: 10, title: "Original", quarter: "2026-Q1", category: "Adultos", organizationId: orgA.id },
    });
    registerLesson(lesson.id);

    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/lessons/${lesson.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Editada", quarter: "2026-Q2" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("Editada");
    expect(data.quarter).toBe("2026-Q2");
  });

  it("19. PUT /api/lessons/[id] alterando para category não atribuída ao professor é bloqueado com HTTP 403", async () => {
    const lesson = await prisma.lesson.create({
      data: { number: 11, title: "Original Prof", quarter: "2026-Q1", category: "Adultos OrgA", organizationId: orgA.id },
    });
    registerLesson(lesson.id);

    const cookie = await switchOrgInSession(professorACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/lessons/${lesson.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ category: "Infantil Proibida" }),
    });
    expect(res.status).toBe(403);
  });

  it("20. PUT /api/lessons/[id] em lição pertencente a outra congregação retorna HTTP 404", async () => {
    const lessonB = await prisma.lesson.create({
      data: { number: 12, title: "Licao Org B", quarter: "2026-Q1", category: "Adultos", organizationId: orgB.id },
    });
    registerLesson(lessonB.id);

    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/lessons/${lessonB.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Hack" }),
    });
    expect(res.status).toBe(404);
  });

  it("21. PUT /api/lessons/[id] em lição global (organizationId = null) via rota local retorna HTTP 404", async () => {
    const globalLesson = await prisma.lesson.create({
      data: { number: 13, title: "Licao Global", quarter: "2026-Q1", category: "Adultos", organizationId: null },
    });
    registerLesson(globalLesson.id);

    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/lessons/${globalLesson.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Hack Global" }),
    });
    expect(res.status).toBe(404);
  });

  it("22. Gestor deleta lição da própria congregação via DELETE /api/lessons/[id]", async () => {
    const lesson = await prisma.lesson.create({
      data: { number: 14, title: "Para Deletar", quarter: "2026-Q1", category: "Adultos", organizationId: orgA.id },
    });
    registerLesson(lesson.id);

    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/lessons/${lesson.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
  });

  it("23. DELETE /api/lessons/[id] em lição de outra congregação retorna HTTP 404", async () => {
    const lessonB = await prisma.lesson.create({
      data: { number: 15, title: "Licao Org B Del", quarter: "2026-Q1", category: "Adultos", organizationId: orgB.id },
    });
    registerLesson(lessonB.id);

    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/lessons/${lessonB.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });

  it("24. DELETE /api/lessons/[id] em lição global via rota local retorna HTTP 404", async () => {
    const globalLesson = await prisma.lesson.create({
      data: { number: 16, title: "Licao Global Del", quarter: "2026-Q1", category: "Adultos", organizationId: null },
    });
    registerLesson(globalLesson.id);

    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/lessons/${globalLesson.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });

  it("25. Ausência de activeOrganizationId nas rotas de lição retorna HTTP 403", async () => {
    const res = await fetch(`${BASE_URL}/api/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminACookie },
      body: JSON.stringify({ number: 99, title: "Sem Org", quarter: "2026-Q1", category: "Adultos" }),
    });
    expect(res.status).toBe(403);
  });

  it("26. Membership inativa nas rotas de lição retorna HTTP 403", async () => {
    const { cookie: inactiveCookie } = await createUserAndLoginInOrg("inactive_prof", "PROFESSOR", orgA.id, {
      membershipStatus: "INACTIVE",
    });
    const cookieWithOrg = await switchOrgInSession(inactiveCookie, orgA.id);

    const res = await fetch(`${BASE_URL}/api/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieWithOrg },
      body: JSON.stringify({ number: 98, title: "Inativo", quarter: "2026-Q1", category: "Adultos" }),
    });
    expect(res.status).toBe(403);
  });

  it("27. Autenticação ausente nas rotas de lição retorna HTTP 401", async () => {
    const res = await fetch(`${BASE_URL}/api/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: 97, title: "Anon", quarter: "2026-Q1", category: "Adultos" }),
    });
    expect(res.status).toBe(401);
  });

  // --- SUBGRUPO 3: Notificações (POST, DELETE) (Tests 28-40, 47) ---
  it("28. Gestor (ADMIN/DIRIGENTE/VICE_DIRIGENTE) dispara comunicado broadcast no POST /api/notifications", async () => {
    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Aviso Geral", message: "Mensagem broadcast" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    registerNotification(data.id);
    expect(data.organizationId).toBe(orgA.id);
    expect(data.senderId).toBe(adminAUser.id);
    expect(data.userId).toBeNull();
  });

  it("29. Global Admin dispara comunicado para a congregação ativa selecionada", async () => {
    const cookie = await switchOrgInSession(globalAdminCookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Aviso Global Admin", message: "Mensagem admin" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    registerNotification(data.id);
    expect(data.organizationId).toBe(orgA.id);
  });

  it("30. Broadcast grava obrigatoriamente organizationId = activeOrganizationId e senderId = user.id", async () => {
    const cookie = await switchOrgInSession(dirigenteACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Aviso Dirigente", message: "Campos automáticos" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    registerNotification(data.id);
    expect(data.organizationId).toBe(orgA.id);
    expect(data.senderId).toBe(dirigenteAUser.id);
  });

  it("31. PROFESSOR ou APOIO tentando criar notificação recebe HTTP 403", async () => {
    const cookie = await switchOrgInSession(professorACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Aviso Prof", message: "Proibido" }),
    });
    expect(res.status).toBe(403);
  });

  it("32. Gestor envia notificação pessoal para userId de membro ativo da mesma congregação", async () => {
    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        title: "Aviso Pessoal",
        message: "Para professor A",
        targetUserId: professorAUser.id,
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    registerNotification(data.id);
    expect(data.userId).toBe(professorAUser.id);
    expect(data.organizationId).toBe(orgA.id);
  });

  it("33. Notificação pessoal para userId pertencente a outra congregação retorna HTTP 404", async () => {
    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        title: "Aviso Cross",
        message: "Para user org B",
        targetUserId: userMemberOrgB.id,
      }),
    });
    expect(res.status).toBe(404);
  });

  it("34. Notificação pessoal para userId com membership inativa retorna HTTP 404", async () => {
    const { user: inactiveUser } = await createUserAndLoginInOrg("user_inativo_target", "APOIO", orgA.id, {
      membershipStatus: "INACTIVE",
    });
    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        title: "Aviso Inativo",
        message: "Para inativo",
        targetUserId: inactiveUser.id,
      }),
    });
    expect(res.status).toBe(404);
  });

  it("35. DELETE /api/notifications/sent?id=... exclui aviso enviado pelo próprio remetente", async () => {
    const notif = await prisma.notification.create({
      data: { title: "Del Sent", message: "Msg", senderId: adminAUser.id, organizationId: orgA.id },
    });
    registerNotification(notif.id);

    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/notifications/sent?id=${notif.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
  });

  it("36. DELETE /api/notifications/sent?id=... em aviso enviado por outro usuário retorna HTTP 404", async () => {
    const notif = await prisma.notification.create({
      data: { title: "Sent por outro", message: "Msg", senderId: dirigenteAUser.id, organizationId: orgA.id },
    });
    registerNotification(notif.id);

    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/notifications/sent?id=${notif.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });

  it("37. DELETE /api/notifications/sent?id=... em aviso de outra congregação retorna HTTP 404", async () => {
    const notifB = await prisma.notification.create({
      data: { title: "Sent Org B", message: "Msg", senderId: adminAUser.id, organizationId: orgB.id },
    });
    registerNotification(notifB.id);

    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/notifications/sent?id=${notifB.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });

  it("38. Notificação com expiresAt no passado é rejeitada com HTTP 400", async () => {
    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        title: "Aviso Expirado",
        message: "Passado",
        expiresAt: "2020-01-01T00:00:00.000Z",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("39. Ausência de activeOrganizationId em notificações retorna HTTP 403", async () => {
    const res = await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminACookie },
      body: JSON.stringify({ title: "Sem Org", message: "Msg" }),
    });
    expect(res.status).toBe(403);
  });

  it("40. Autenticação ausente em notificações retorna HTTP 401", async () => {
    const res = await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Anon", message: "Msg" }),
    });
    expect(res.status).toBe(401);
  });

  // --- SUBGRUPO 4: Testes Complementares de Borda (Tests 41-48) ---
  it("41. APOIO com CSA cria justificativa para estudante da turma atribuída", async () => {
    const cookie = await switchOrgInSession(apoioACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/justifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ studentId: studentA.id, date: "2026-03-15", reason: "Apoio Justifica" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    registerJustification(data.id);
  });

  it("42. APOIO com CSA registra chamada da turma atribuída", async () => {
    const cookie = await switchOrgInSession(apoioACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        classId: classA.id,
        date: "2026-03-16",
        items: [{ studentId: studentA.id, status: "PRESENTE" }],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    registerAttendanceRecord(data.recordId);
  });

  it("43. Attendance rejeita estudante de outra turma da mesma organização com HTTP 404", async () => {
    const outraClass = await prisma.class.create({
      data: { name: "Outra Turma OrgA", organizationId: orgA.id, status: true },
    });
    registerClass(outraClass.id);

    const outroStudent = await prisma.student.create({
      data: { name: "Aluno Outra Turma", classId: outraClass.id, organizationId: orgA.id, active: true },
    });
    registerStudent(outroStudent.id);

    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        classId: classA.id,
        date: "2026-03-17",
        items: [{ studentId: outroStudent.id, status: "PRESENTE" }],
      }),
    });
    expect(res.status).toBe(404);
  });

  it("44. Attendance com lote misto válido/inválido não grava nenhum registro", async () => {
    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        classId: classA.id,
        date: "2026-03-18",
        items: [
          { studentId: studentA.id, status: "PRESENTE" },
          { studentId: studentB.id, status: "PRESENTE" }, // aluno org B
        ],
      }),
    });
    expect(res.status).toBe(404);

    const rec = await prisma.attendanceRecord.findFirst({
      where: { classId: classA.id, date: new Date("2026-03-18T00:00:00.000Z") },
    });
    expect(rec).toBeNull();
  });

  it("45. Attendance grava organizationId correto no AttendanceRecord e itens exatos", async () => {
    const cookie = await switchOrgInSession(adminACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        classId: classA.id,
        date: "2026-03-19",
        biblias: 5,
        revistas: 4,
        ofertas: 10.5,
        outros: 1,
        items: [{ studentId: studentA.id, status: "PRESENTE" }],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    registerAttendanceRecord(data.recordId);

    const record = await prisma.attendanceRecord.findUnique({
      where: { id: data.recordId },
      include: { items: true },
    });
    expect(record?.organizationId).toBe(orgA.id);
    expect(record?.items.length).toBe(1);
    expect(record?.items[0].studentId).toBe(studentA.id);
  });

  it("46. APOIO com CSA cria lição para categoria atribuída", async () => {
    const cookie = await switchOrgInSession(apoioACookie, orgA.id);
    const res = await fetch(`${BASE_URL}/api/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        number: 20,
        title: "Lição Apoio",
        quarter: "2026-Q1",
        category: "Adultos OrgA",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    registerLesson(data.id);
    expect(data.organizationId).toBe(orgA.id);
  });

  it("47. Membership inativa bloqueia criação e exclusão de notificações com HTTP 403", async () => {
    const { cookie: inactiveCookie } = await createUserAndLoginInOrg("inactive_admin_notif", "ADMIN", orgA.id, {
      membershipStatus: "INACTIVE",
    });
    const cookieWithOrg = await switchOrgInSession(inactiveCookie, orgA.id);

    const resPost = await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieWithOrg },
      body: JSON.stringify({ title: "Inativo", message: "Msg" }),
    });
    expect(resPost.status).toBe(403);

    const resDel = await fetch(`${BASE_URL}/api/notifications/sent?id=some-id`, {
      method: "DELETE",
      headers: { Cookie: cookieWithOrg },
    });
    expect(resDel.status).toBe(403);
  });

  it("48. Campos controlados pelo servidor são rejeitados em justificativas, attendance e notificações com HTTP 400", async () => {
    const cookie = await switchOrgInSession(adminACookie, orgA.id);

    const resJust = await fetch(`${BASE_URL}/api/justifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        studentId: studentA.id,
        date: "2026-03-20",
        reason: "Injeção",
        organizationId: orgB.id,
      }),
    });
    expect(resJust.status).toBe(400);

    const resAtt = await fetch(`${BASE_URL}/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        classId: classA.id,
        date: "2026-03-20",
        organizationId: orgB.id,
        items: [{ studentId: studentA.id, status: "PRESENTE" }],
      }),
    });
    expect(resAtt.status).toBe(400);

    const resNotif = await fetch(`${BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        title: "Injeção",
        message: "Msg",
        senderId: userMemberOrgB.id,
      }),
    });
    expect(resNotif.status).toBe(400);
  });
});
