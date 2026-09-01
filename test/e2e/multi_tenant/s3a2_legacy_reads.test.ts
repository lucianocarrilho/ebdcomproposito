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
const trackedStudentIds = new Set<string>();
const trackedLeaderIds = new Set<string>();
const trackedJustificationIds = new Set<string>();
const trackedLeaderAttendanceIds = new Set<string>();
const trackedLessonIds = new Set<string>();
const trackedNotificationIds = new Set<string>();
const trackedOrgIds = new Set<string>();

// Group 2: Audit Sets (never cleared, used in afterAll to detect any memory/db leaks)
const allCreatedCsaIds = new Set<string>();
const allCreatedMembershipIds = new Set<string>();
const allCreatedUserIds = new Set<string>();
const allCreatedClassIds = new Set<string>();
const allCreatedStudentIds = new Set<string>();
const allCreatedLeaderIds = new Set<string>();
const allCreatedJustificationIds = new Set<string>();
const allCreatedLeaderAttendanceIds = new Set<string>();
const allCreatedLessonIds = new Set<string>();
const allCreatedNotificationIds = new Set<string>();
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

function registerStudent(id: string) {
  trackedStudentIds.add(id);
  allCreatedStudentIds.add(id);
  return id;
}

function registerLeader(id: string) {
  trackedLeaderIds.add(id);
  allCreatedLeaderIds.add(id);
  return id;
}

function registerJustification(id: string) {
  trackedJustificationIds.add(id);
  allCreatedJustificationIds.add(id);
  return id;
}

function registerLeaderAttendance(id: string) {
  trackedLeaderAttendanceIds.add(id);
  allCreatedLeaderAttendanceIds.add(id);
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

export async function cleanupTrackedIds() {
  const csaList = Array.from(trackedCsaIds);
  const justList = Array.from(trackedJustificationIds);
  const leaderAttList = Array.from(trackedLeaderAttendanceIds);
  const studList = Array.from(trackedStudentIds);
  const leadList = Array.from(trackedLeaderIds);
  const classList = Array.from(trackedClassIds);
  const memList = Array.from(trackedMembershipIds);
  const userList = Array.from(trackedUserIds);
  const lessonList = Array.from(trackedLessonIds);
  const notifList = Array.from(trackedNotificationIds);
  const orgList = Array.from(trackedOrgIds);

  if (
    csaList.length === 0 &&
    justList.length === 0 &&
    leaderAttList.length === 0 &&
    studList.length === 0 &&
    leadList.length === 0 &&
    classList.length === 0 &&
    memList.length === 0 &&
    userList.length === 0 &&
    lessonList.length === 0 &&
    notifList.length === 0 &&
    orgList.length === 0
  ) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (justList.length > 0) {
      await tx.absenceJustification.deleteMany({ where: { id: { in: justList } } });
    }
    if (leaderAttList.length > 0) {
      await tx.leaderAttendance.deleteMany({ where: { id: { in: leaderAttList } } });
    }
    if (csaList.length > 0) {
      await tx.classStaffAssignment.deleteMany({ where: { id: { in: csaList } } });
    }
    if (notifList.length > 0) {
      await tx.notificationRead.deleteMany({ where: { notificationId: { in: notifList } } });
      await tx.notification.deleteMany({ where: { id: { in: notifList } } });
    }
    if (lessonList.length > 0) {
      await tx.lesson.deleteMany({ where: { id: { in: lessonList } } });
    }
    if (studList.length > 0) {
      await tx.student.deleteMany({ where: { id: { in: studList } } });
    }
    if (leadList.length > 0) {
      await tx.leader.deleteMany({ where: { id: { in: leadList } } });
    }
    if (classList.length > 0) {
      await tx.class.deleteMany({ where: { id: { in: classList } } });
    }
    if (memList.length > 0) {
      await tx.organizationMembership.deleteMany({ where: { id: { in: memList } } });
    }
    if (userList.length > 0) {
      await tx.user.deleteMany({ where: { id: { in: userList } } });
    }
    if (orgList.length > 0) {
      await tx.organization.deleteMany({ where: { id: { in: orgList } } });
    }
  });

  trackedCsaIds.clear();
  trackedJustificationIds.clear();
  trackedLeaderAttendanceIds.clear();
  trackedStudentIds.clear();
  trackedLeaderIds.clear();
  trackedClassIds.clear();
  trackedMembershipIds.clear();
  trackedUserIds.clear();
  trackedLessonIds.clear();
  trackedNotificationIds.clear();
  trackedOrgIds.clear();
}

async function createUserAndLoginInOrg(targetOrgId: string, role: string = "PROFESSOR") {
  const testId = randomUUID();
  const email = `test_${testId}@test.com`;
  const password = "password123";

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

  const membership = await prisma.organizationMembership.create({
    data: {
      userId: user.id,
      organizationId: targetOrgId,
      role: role as any,
      status: "ACTIVE"
    }
  });
  registerMembership(membership.id);

  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  const cookies = csrfRes.headers.get("set-cookie") || "";
  const parsedCookies = cookies.split(",").map((c) => c.split(";")[0]).join("; ");

  const loginForm = new URLSearchParams();
  loginForm.append("email", email);
  loginForm.append("password", password);
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

describe("S3A.2: Legacy Reads Isolation (Justifications, Lessons, Notifications)", () => {
  let orgA: any;
  let orgB: any;

  beforeEach(async () => {
    const idA = randomUUID();
    orgA = await prisma.organization.create({
      data: { name: "Org A", slug: `org-a-${idA}`, active: true }
    });
    registerOrg(orgA.id);

    const idB = randomUUID();
    orgB = await prisma.organization.create({
      data: { name: "Org B", slug: `org-b-${idB}`, active: true }
    });
    registerOrg(orgB.id);
  }, 60_000);

  afterEach(async () => {
    await cleanupTrackedIds();
  }, 60_000);

  afterAll(async () => {
    try {
      await cleanupTrackedIds();

      const csaAudit = Array.from(allCreatedCsaIds);
      const justAudit = Array.from(allCreatedJustificationIds);
      const leadAttAudit = Array.from(allCreatedLeaderAttendanceIds);
      const studAudit = Array.from(allCreatedStudentIds);
      const leadAudit = Array.from(allCreatedLeaderIds);
      const classAudit = Array.from(allCreatedClassIds);
      const memAudit = Array.from(allCreatedMembershipIds);
      const userAudit = Array.from(allCreatedUserIds);
      const lessonAudit = Array.from(allCreatedLessonIds);
      const notifAudit = Array.from(allCreatedNotificationIds);
      const orgAudit = Array.from(allCreatedOrgIds);

      const remCsa = csaAudit.length > 0 ? await prisma.classStaffAssignment.count({ where: { id: { in: csaAudit } } }) : 0;
      const remJust = justAudit.length > 0 ? await prisma.absenceJustification.count({ where: { id: { in: justAudit } } }) : 0;
      const remLeadAtt = leadAttAudit.length > 0 ? await prisma.leaderAttendance.count({ where: { id: { in: leadAttAudit } } }) : 0;
      const remStud = studAudit.length > 0 ? await prisma.student.count({ where: { id: { in: studAudit } } }) : 0;
      const remLead = leadAudit.length > 0 ? await prisma.leader.count({ where: { id: { in: leadAudit } } }) : 0;
      const remClass = classAudit.length > 0 ? await prisma.class.count({ where: { id: { in: classAudit } } }) : 0;
      const remMem = memAudit.length > 0 ? await prisma.organizationMembership.count({ where: { id: { in: memAudit } } }) : 0;
      const remUser = userAudit.length > 0 ? await prisma.user.count({ where: { id: { in: userAudit } } }) : 0;
      const remLesson = lessonAudit.length > 0 ? await prisma.lesson.count({ where: { id: { in: lessonAudit } } }) : 0;
      const remNotif = notifAudit.length > 0 ? await prisma.notification.count({ where: { id: { in: notifAudit } } }) : 0;
      const remOrg = orgAudit.length > 0 ? await prisma.organization.count({ where: { id: { in: orgAudit } } }) : 0;

      const totalLeaks = remCsa + remJust + remLeadAtt + remStud + remLead + remClass + remMem + remUser + remLesson + remNotif + remOrg;
      if (totalLeaks > 0) {
        throw new Error(`LEAK_DETECTED: Total de ${totalLeaks} registros vazaram no banco _test`);
      }
    } finally {
      await prisma.$disconnect();
    }
  }, 60_000);

  // --- JUSTIFICATIONS TESTS ---

  it("1. GET /api/justifications: ADMIN limitado à organização ativa", async () => {
    const admin = await createUserAndLoginInOrg(orgA.id, "ADMIN");

    const cls = await prisma.class.create({ data: { name: `C1 ${admin.testId}`, organizationId: orgA.id, status: true } });
    registerClass(cls.id);

    const stud = await prisma.student.create({ data: { name: `S1 ${admin.testId}`, classId: cls.id, organizationId: orgA.id } });
    registerStudent(stud.id);

    const just = await prisma.absenceJustification.create({
      data: { studentId: stud.id, date: new Date(), reason: "Doença", organizationId: orgA.id }
    });
    registerJustification(just.id);

    const res = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: admin.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((j: any) => j.id === just.id)).toBe(true);
  });

  it("2. GET /api/justifications: DIRIGENTE limitado à organização ativa", async () => {
    const dirigente = await createUserAndLoginInOrg(orgA.id, "DIRIGENTE");

    const cls = await prisma.class.create({ data: { name: `C2 ${dirigente.testId}`, organizationId: orgA.id, status: true } });
    registerClass(cls.id);

    const stud = await prisma.student.create({ data: { name: `S2 ${dirigente.testId}`, classId: cls.id, organizationId: orgA.id } });
    registerStudent(stud.id);

    const just = await prisma.absenceJustification.create({
      data: { studentId: stud.id, date: new Date(), reason: "Viagem", organizationId: orgA.id }
    });
    registerJustification(just.id);

    const res = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: dirigente.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((j: any) => j.id === just.id)).toBe(true);
  });

  it("3. GET /api/justifications: PROFESSOR com CSA ativo vê apenas justificativas dos alunos de suas turmas", async () => {
    const prof = await createUserAndLoginInOrg(orgA.id, "PROFESSOR");

    const cls1 = await prisma.class.create({ data: { name: `C3-1 ${prof.testId}`, organizationId: orgA.id, status: true } });
    registerClass(cls1.id);
    const cls2 = await prisma.class.create({ data: { name: `C3-2 ${prof.testId}`, organizationId: orgA.id, status: true } });
    registerClass(cls2.id);

    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: orgA.id, classId: cls1.id, organizationMembershipId: prof.membership.id, assignmentRole: "PROFESSOR", active: true }
    });
    registerCsa(csa.id);

    const stud1 = await prisma.student.create({ data: { name: `S3-1 ${prof.testId}`, classId: cls1.id, organizationId: orgA.id } });
    registerStudent(stud1.id);
    const stud2 = await prisma.student.create({ data: { name: `S3-2 ${prof.testId}`, classId: cls2.id, organizationId: orgA.id } });
    registerStudent(stud2.id);

    const just1 = await prisma.absenceJustification.create({ data: { studentId: stud1.id, date: new Date(), reason: "Febre", organizationId: orgA.id } });
    registerJustification(just1.id);
    const just2 = await prisma.absenceJustification.create({ data: { studentId: stud2.id, date: new Date(), reason: "Trabalho", organizationId: orgA.id } });
    registerJustification(just2.id);

    const res = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: prof.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((j: any) => j.id === just1.id)).toBe(true);
    expect(data.some((j: any) => j.id === just2.id)).toBe(false);
  });

  it("4. GET /api/justifications: APOIO com CSA ativo vê apenas justificativas dos alunos de suas turmas", async () => {
    const apoio = await createUserAndLoginInOrg(orgA.id, "APOIO");

    const cls = await prisma.class.create({ data: { name: `C4 ${apoio.testId}`, organizationId: orgA.id, status: true } });
    registerClass(cls.id);

    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: orgA.id, classId: cls.id, organizationMembershipId: apoio.membership.id, assignmentRole: "AUXILIAR", active: true }
    });
    registerCsa(csa.id);

    const stud = await prisma.student.create({ data: { name: `S4 ${apoio.testId}`, classId: cls.id, organizationId: orgA.id } });
    registerStudent(stud.id);

    const just = await prisma.absenceJustification.create({ data: { studentId: stud.id, date: new Date(), reason: "Consulta", organizationId: orgA.id } });
    registerJustification(just.id);

    const res = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: apoio.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((j: any) => j.id === just.id)).toBe(true);
  });

  it("5. GET /api/justifications: Sem CSA retorna lista vazia []", async () => {
    const prof = await createUserAndLoginInOrg(orgA.id, "PROFESSOR");
    const res = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: prof.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  it("6. GET /api/justifications: CSA inativo retorna lista vazia []", async () => {
    const prof = await createUserAndLoginInOrg(orgA.id, "PROFESSOR");
    const cls = await prisma.class.create({ data: { name: `C6 ${prof.testId}`, organizationId: orgA.id, status: true } });
    registerClass(cls.id);

    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: orgA.id, classId: cls.id, organizationMembershipId: prof.membership.id, assignmentRole: "PROFESSOR", active: false }
    });
    registerCsa(csa.id);

    const res = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: prof.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(0);
  });

  it("7. GET /api/justifications: Classe inativa é bloqueada", async () => {
    const prof = await createUserAndLoginInOrg(orgA.id, "PROFESSOR");
    const cls = await prisma.class.create({ data: { name: `C7 ${prof.testId}`, organizationId: orgA.id, status: false } });
    registerClass(cls.id);

    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: orgA.id, classId: cls.id, organizationMembershipId: prof.membership.id, assignmentRole: "PROFESSOR", active: true }
    });
    registerCsa(csa.id);

    const stud = await prisma.student.create({ data: { name: `S7 ${prof.testId}`, classId: cls.id, organizationId: orgA.id } });
    registerStudent(stud.id);

    const just = await prisma.absenceJustification.create({ data: { studentId: stud.id, date: new Date(), reason: "R7", organizationId: orgA.id } });
    registerJustification(just.id);

    const res = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: prof.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((j: any) => j.id === just.id)).toBe(false);
  });

  it("8. GET /api/justifications: organizationId divergente na justification é bloqueado", async () => {
    const admin = await createUserAndLoginInOrg(orgA.id, "ADMIN");
    const cls = await prisma.class.create({ data: { name: `C8 ${admin.testId}`, organizationId: orgA.id, status: true } });
    registerClass(cls.id);

    const stud = await prisma.student.create({ data: { name: `S8 ${admin.testId}`, classId: cls.id, organizationId: orgA.id } });
    registerStudent(stud.id);

    const justOther = await prisma.absenceJustification.create({
      data: { studentId: stud.id, date: new Date(), reason: "Divergente", organizationId: orgB.id }
    });
    registerJustification(justOther.id);

    const res = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: admin.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((j: any) => j.id === justOther.id)).toBe(false);
  });

  it("9. GET /api/justifications: organizationId null legado só entra pela relação Student/Class correta", async () => {
    const admin = await createUserAndLoginInOrg(orgA.id, "ADMIN");
    const clsA = await prisma.class.create({ data: { name: `C9A ${admin.testId}`, organizationId: orgA.id, status: true } });
    registerClass(clsA.id);

    const studA = await prisma.student.create({ data: { name: `S9A ${admin.testId}`, classId: clsA.id, organizationId: orgA.id } });
    registerStudent(studA.id);

    const justNullA = await prisma.absenceJustification.create({
      data: { studentId: studA.id, date: new Date(), reason: "NullLegadoA", organizationId: null }
    });
    registerJustification(justNullA.id);

    const res = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: admin.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((j: any) => j.id === justNullA.id)).toBe(true);
  });

  it("10. GET /api/justifications: Liderança isolada por organização", async () => {
    const admin = await createUserAndLoginInOrg(orgA.id, "ADMIN");

    const leaderA = await prisma.leader.create({ data: { name: `L10A ${admin.testId}`, role: "Dirigente", organizationId: orgA.id, active: true } });
    registerLeader(leaderA.id);

    const leaderB = await prisma.leader.create({ data: { name: `L10B ${admin.testId}`, role: "Dirigente", organizationId: orgB.id, active: true } });
    registerLeader(leaderB.id);

    const laA = await prisma.leaderAttendance.create({ data: { leaderId: leaderA.id, date: new Date(), status: "FALTA_JUSTIFICADA", justification: "J10A" } });
    registerLeaderAttendance(laA.id);

    const laB = await prisma.leaderAttendance.create({ data: { leaderId: leaderB.id, date: new Date(), status: "FALTA_JUSTIFICADA", justification: "J10B" } });
    registerLeaderAttendance(laB.id);

    const res = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: admin.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((j: any) => j.id === laA.id)).toBe(true);
    expect(data.some((j: any) => j.id === laB.id)).toBe(false);
  });

  it("11. GET /api/justifications: PROFESSOR/APOIO não recebem LeaderAttendance", async () => {
    const prof = await createUserAndLoginInOrg(orgA.id, "PROFESSOR");
    const leaderA = await prisma.leader.create({ data: { name: `L11 ${prof.testId}`, role: "Dirigente", organizationId: orgA.id, active: true } });
    registerLeader(leaderA.id);

    const laA = await prisma.leaderAttendance.create({ data: { leaderId: leaderA.id, date: new Date(), status: "FALTA_JUSTIFICADA", justification: "J11" } });
    registerLeaderAttendance(laA.id);

    const res = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: prof.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((j: any) => j.isLeader === true)).toBe(false);
  });

  it("12. GET /api/justifications: Isolamento bilateral A/B", async () => {
    const adminA = await createUserAndLoginInOrg(orgA.id, "ADMIN");
    const clsA = await prisma.class.create({ data: { name: `C12A ${adminA.testId}`, organizationId: orgA.id, status: true } });
    registerClass(clsA.id);
    const studA = await prisma.student.create({ data: { name: `S12A ${adminA.testId}`, classId: clsA.id, organizationId: orgA.id } });
    registerStudent(studA.id);
    const justA = await prisma.absenceJustification.create({ data: { studentId: studA.id, date: new Date(), reason: "JA", organizationId: orgA.id } });
    registerJustification(justA.id);

    const clsB = await prisma.class.create({ data: { name: `C12B ${adminA.testId}`, organizationId: orgB.id, status: true } });
    registerClass(clsB.id);
    const studB = await prisma.student.create({ data: { name: `S12B ${adminA.testId}`, classId: clsB.id, organizationId: orgB.id } });
    registerStudent(studB.id);
    const justB = await prisma.absenceJustification.create({ data: { studentId: studB.id, date: new Date(), reason: "JB", organizationId: orgB.id } });
    registerJustification(justB.id);

    const resA = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: adminA.cookies } });
    expect(resA.status).toBe(200);
    const dataA = await resA.json();
    expect(dataA.some((j: any) => j.id === justA.id)).toBe(true);
    expect(dataA.some((j: any) => j.id === justB.id)).toBe(false);
  });

  // --- LESSONS TESTS ---

  it("13. GET /api/lessons: Gestor recebe lições da organização ativa e globais válidas", async () => {
    const admin = await createUserAndLoginInOrg(orgA.id, "ADMIN");

    const lesOrg = await prisma.lesson.create({ data: { number: 1, title: "L13-Org", quarter: "2026-Q2", category: "Adultos", organizationId: orgA.id } });
    registerLesson(lesOrg.id);

    const lesGlobal = await prisma.lesson.create({ data: { number: 2, title: "L13-Global", quarter: "2026-Q2", category: "Adultos", organizationId: null, classId: null } });
    registerLesson(lesGlobal.id);

    const res = await fetch(`${baseUrl}/api/lessons?quarter=2026-Q2`, { headers: { Cookie: admin.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((l: any) => l.id === lesOrg.id)).toBe(true);
    expect(data.some((l: any) => l.id === lesGlobal.id)).toBe(true);
  });

  it("14. GET /api/lessons: PROFESSOR recebe apenas lições de categorias das classes atribuídas", async () => {
    const prof = await createUserAndLoginInOrg(orgA.id, "PROFESSOR");
    const cls = await prisma.class.create({ data: { name: "Jovens", organizationId: orgA.id, status: true } });
    registerClass(cls.id);

    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: orgA.id, classId: cls.id, organizationMembershipId: prof.membership.id, assignmentRole: "PROFESSOR", active: true }
    });
    registerCsa(csa.id);

    const lesJovens = await prisma.lesson.create({ data: { number: 1, title: "Lição Jovens", quarter: "2026-Q2", category: "Jovens", organizationId: orgA.id, classId: cls.id } });
    registerLesson(lesJovens.id);

    const lesAdultos = await prisma.lesson.create({ data: { number: 2, title: "Lição Adultos", quarter: "2026-Q2", category: "Adultos", organizationId: orgA.id } });
    registerLesson(lesAdultos.id);

    const res = await fetch(`${baseUrl}/api/lessons?quarter=2026-Q2`, { headers: { Cookie: prof.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((l: any) => l.id === lesJovens.id)).toBe(true);
    expect(data.some((l: any) => l.id === lesAdultos.id)).toBe(false);
  });

  it("15. GET /api/lessons: APOIO recebe apenas lições de categorias das classes atribuídas", async () => {
    const apoio = await createUserAndLoginInOrg(orgA.id, "APOIO");
    const cls = await prisma.class.create({ data: { name: "Crianças", organizationId: orgA.id, status: true } });
    registerClass(cls.id);

    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: orgA.id, classId: cls.id, organizationMembershipId: apoio.membership.id, assignmentRole: "AUXILIAR", active: true }
    });
    registerCsa(csa.id);

    const lesCriancas = await prisma.lesson.create({ data: { number: 1, title: "Lição Crianças", quarter: "2026-Q2", category: "Crianças", organizationId: orgA.id, classId: cls.id } });
    registerLesson(lesCriancas.id);

    const res = await fetch(`${baseUrl}/api/lessons?quarter=2026-Q2`, { headers: { Cookie: apoio.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((l: any) => l.id === lesCriancas.id)).toBe(true);
  });

  it("16. GET /api/lessons: Sem CSA ou CSA inativo retorna lista vazia []", async () => {
    const prof = await createUserAndLoginInOrg(orgA.id, "PROFESSOR");
    const res = await fetch(`${baseUrl}/api/lessons?quarter=2026-Q2`, { headers: { Cookie: prof.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(0);
  });

  it("17. GET /api/lessons: Classe inativa é bloqueada", async () => {
    const prof = await createUserAndLoginInOrg(orgA.id, "PROFESSOR");
    const cls = await prisma.class.create({ data: { name: "Adolescentes", organizationId: orgA.id, status: false } });
    registerClass(cls.id);

    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: orgA.id, classId: cls.id, organizationMembershipId: prof.membership.id, assignmentRole: "PROFESSOR", active: true }
    });
    registerCsa(csa.id);

    const les = await prisma.lesson.create({ data: { number: 1, title: "L17", quarter: "2026-Q2", category: "Adolescentes", organizationId: orgA.id, classId: cls.id } });
    registerLesson(les.id);

    const res = await fetch(`${baseUrl}/api/lessons?quarter=2026-Q2`, { headers: { Cookie: prof.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(0);
  });

  it("18. GET /api/lessons: Lição de outra organização não vaza", async () => {
    const admin = await createUserAndLoginInOrg(orgA.id, "ADMIN");
    const lesB = await prisma.lesson.create({ data: { number: 1, title: "L18-B", quarter: "2026-Q2", category: "Adultos", organizationId: orgB.id } });
    registerLesson(lesB.id);

    const res = await fetch(`${baseUrl}/api/lessons?quarter=2026-Q2`, { headers: { Cookie: admin.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((l: any) => l.id === lesB.id)).toBe(false);
  });

  it("19. GET /api/lessons: Lição global com classId não é tratada como global", async () => {
    const admin = await createUserAndLoginInOrg(orgA.id, "ADMIN");
    const clsB = await prisma.class.create({ data: { name: "C19B", organizationId: orgB.id, status: true } });
    registerClass(clsB.id);

    const lesFakeGlobal = await prisma.lesson.create({
      data: { number: 1, title: "L19-FakeGlobal", quarter: "2026-Q2", category: "Adultos", organizationId: null, classId: clsB.id }
    });
    registerLesson(lesFakeGlobal.id);

    const res = await fetch(`${baseUrl}/api/lessons?quarter=2026-Q2`, { headers: { Cookie: admin.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((l: any) => l.id === lesFakeGlobal.id)).toBe(false);
  });

  it("20. GET /api/lessons: gestor não recebe lição com organizationId da congregação ativa e classId de outra congregação", async () => {
    const admin = await createUserAndLoginInOrg(orgA.id, "ADMIN");
    const clsB = await prisma.class.create({ data: { name: "C20B", organizationId: orgB.id, status: true } });
    registerClass(clsB.id);

    const lesInconsistent = await prisma.lesson.create({
      data: { number: 1, title: "L20-Inconsistent", quarter: "2026-Q2", category: "Adultos", organizationId: orgA.id, classId: clsB.id }
    });
    registerLesson(lesInconsistent.id);

    const res = await fetch(`${baseUrl}/api/lessons?quarter=2026-Q2`, { headers: { Cookie: admin.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((l: any) => l.id === lesInconsistent.id)).toBe(false);
  });

  it("21. GET /api/lessons: Isolamento bilateral A/B", async () => {
    const adminA = await createUserAndLoginInOrg(orgA.id, "ADMIN");
    const lesA = await prisma.lesson.create({ data: { number: 1, title: "L21A", quarter: "2026-Q2", category: "Adultos", organizationId: orgA.id } });
    registerLesson(lesA.id);
    const lesB = await prisma.lesson.create({ data: { number: 2, title: "L21B", quarter: "2026-Q2", category: "Adultos", organizationId: orgB.id } });
    registerLesson(lesB.id);

    const resA = await fetch(`${baseUrl}/api/lessons?quarter=2026-Q2`, { headers: { Cookie: adminA.cookies } });
    expect(resA.status).toBe(200);
    const dataA = await resA.json();
    expect(dataA.some((l: any) => l.id === lesA.id)).toBe(true);
    expect(dataA.some((l: any) => l.id === lesB.id)).toBe(false);
  });

  // --- NOTIFICATIONS TESTS ---

  it("22. GET /api/notifications: Broadcast da organização ativa", async () => {
    const admin = await createUserAndLoginInOrg(orgA.id, "ADMIN");
    const notifValid = await prisma.notification.create({
      data: { title: "N22", message: "Broadcast OrgA", active: true, organizationId: orgA.id, userId: null, expiresAt: null }
    });
    registerNotification(notifValid.id);

    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const notifExpired = await prisma.notification.create({
      data: { title: "N22 Expirada", message: "Expirada OrgA", active: true, organizationId: orgA.id, userId: null, expiresAt: pastDate }
    });
    registerNotification(notifExpired.id);

    const res = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: admin.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((n: any) => n.id === notifValid.id)).toBe(true);
    expect(data.some((n: any) => n.id === notifExpired.id)).toBe(false);
  });

  it("23. GET /api/notifications: Notificação pessoal da organização ativa", async () => {
    const admin = await createUserAndLoginInOrg(orgA.id, "ADMIN");
    const notif = await prisma.notification.create({
      data: { title: "N23", message: "Pessoal OrgA", active: true, organizationId: orgA.id, userId: admin.user.id }
    });
    registerNotification(notif.id);

    const res = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: admin.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((n: any) => n.id === notif.id)).toBe(true);
  });

  it("24. GET /api/notifications: Broadcast global válido (organizationId null e userId null)", async () => {
    const admin = await createUserAndLoginInOrg(orgA.id, "ADMIN");
    const notif = await prisma.notification.create({
      data: { title: "N24", message: "Broadcast Global", active: true, organizationId: null, userId: null }
    });
    registerNotification(notif.id);

    const res = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: admin.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((n: any) => n.id === notif.id)).toBe(true);
  });

  it("25. GET /api/notifications: Notificação pessoal de outra organização é bloqueada", async () => {
    const admin = await createUserAndLoginInOrg(orgA.id, "ADMIN");
    const notifB = await prisma.notification.create({
      data: { title: "N25", message: "Pessoal OrgB", active: true, organizationId: orgB.id, userId: admin.user.id }
    });
    registerNotification(notifB.id);

    const res = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: admin.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((n: any) => n.id === notifB.id)).toBe(false);
  });

  it("26. GET /api/notifications: Aniversariantes filtrados por organização ativa e CSA", async () => {
    const prof = await createUserAndLoginInOrg(orgA.id, "PROFESSOR");
    const cls = await prisma.class.create({ data: { name: "C26", organizationId: orgA.id, status: true } });
    registerClass(cls.id);

    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: orgA.id, classId: cls.id, organizationMembershipId: prof.membership.id, assignmentRole: "PROFESSOR", active: true }
    });
    registerCsa(csa.id);

    const today = new Date();
    const studBday = await prisma.student.create({
      data: { name: "Aniversariante 26", birthDate: today, classId: cls.id, organizationId: orgA.id, active: true }
    });
    registerStudent(studBday.id);

    const res = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: prof.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((n: any) => n.id === `bday-${studBday.id}`)).toBe(true);
  });

  it("27. GET /api/notifications: Sem CSA não recebe aniversariantes", async () => {
    const prof = await createUserAndLoginInOrg(orgA.id, "PROFESSOR");
    const cls = await prisma.class.create({ data: { name: "C27", organizationId: orgA.id, status: true } });
    registerClass(cls.id);

    const today = new Date();
    const studBday = await prisma.student.create({
      data: { name: "Aniversariante 27", birthDate: today, classId: cls.id, organizationId: orgA.id, active: true }
    });
    registerStudent(studBday.id);

    const res = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: prof.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((n: any) => n.isBirthday === true)).toBe(false);
  });

  it("28. GET /api/notifications: CSA inativo ou classe inativa bloqueia aniversariantes", async () => {
    const prof = await createUserAndLoginInOrg(orgA.id, "PROFESSOR");
    const cls = await prisma.class.create({ data: { name: "C28", organizationId: orgA.id, status: false } });
    registerClass(cls.id);

    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: orgA.id, classId: cls.id, organizationMembershipId: prof.membership.id, assignmentRole: "PROFESSOR", active: true }
    });
    registerCsa(csa.id);

    const today = new Date();
    const studBday = await prisma.student.create({
      data: { name: "Aniversariante 28", birthDate: today, classId: cls.id, organizationId: orgA.id, active: true }
    });
    registerStudent(studBday.id);

    const res = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: prof.cookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((n: any) => n.id === `bday-${studBday.id}`)).toBe(false);
  });

  it("29. GET /api/notifications: Isolamento bilateral A/B", async () => {
    const adminA = await createUserAndLoginInOrg(orgA.id, "ADMIN");
    const notifA = await prisma.notification.create({
      data: { title: "N29A", message: "Msg A", active: true, organizationId: orgA.id, userId: null }
    });
    registerNotification(notifA.id);

    const notifB = await prisma.notification.create({
      data: { title: "N29B", message: "Msg B", active: true, organizationId: orgB.id, userId: null }
    });
    registerNotification(notifB.id);

    const resA = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: adminA.cookies } });
    expect(resA.status).toBe(200);
    const dataA = await resA.json();
    expect(dataA.some((n: any) => n.id === notifA.id)).toBe(true);
    expect(dataA.some((n: any) => n.id === notifB.id)).toBe(false);
  });

  // --- AUTHORIZATION TESTS ---

  it("30. Ausência de activeOrganizationId retorna HTTP 403 nos três endpoints", async () => {
    const userNoOrg = await createUserAndLoginInOrg(orgA.id, "PROFESSOR");

    const resJ = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: userNoOrg.rawAuthCookies } });
    expect(resJ.status).toBe(403);

    const resL = await fetch(`${baseUrl}/api/lessons`, { headers: { Cookie: userNoOrg.rawAuthCookies } });
    expect(resL.status).toBe(403);

    const resN = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: userNoOrg.rawAuthCookies } });
    expect(resN.status).toBe(403);
  });

  it("31. Membership inativa retorna HTTP 403 nos três endpoints", async () => {
    const prof = await createUserAndLoginInOrg(orgA.id, "PROFESSOR");
    await prisma.organizationMembership.update({
      where: { id: prof.membership.id },
      data: { status: "INACTIVE" }
    });

    const resJ = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: prof.cookies } });
    expect(resJ.status).toBe(403);

    const resL = await fetch(`${baseUrl}/api/lessons`, { headers: { Cookie: prof.cookies } });
    expect(resL.status).toBe(403);

    const resN = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: prof.cookies } });
    expect(resN.status).toBe(403);
  });

  it("32. Global Admin permanece limitado à organização selecionada", async () => {
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
        data: { activeOrganizationId: orgA.id }
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

    const notifA = await prisma.notification.create({
      data: { title: "N32A", message: "OrgA", active: true, organizationId: orgA.id, userId: null }
    });
    registerNotification(notifA.id);

    const notifB = await prisma.notification.create({
      data: { title: "N32B", message: "OrgB", active: true, organizationId: orgB.id, userId: null }
    });
    registerNotification(notifB.id);

    const res = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: adminCookies } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((n: any) => n.id === notifA.id)).toBe(true);
    expect(data.some((n: any) => n.id === notifB.id)).toBe(false);
  });

  it("33. switch para organização sem membership é rejeitado e mantém o isolamento da organização ativa", async () => {
    // 1. Criar usuário PROFESSOR com membership ativa somente na organização B
    const profB = await createUserAndLoginInOrg(orgB.id, "PROFESSOR");

    // Criar fixtures marcadoras na Org A e Org B
    const clsA = await prisma.class.create({ data: { name: `ClasseA ${profB.testId}`, organizationId: orgA.id, status: true } });
    registerClass(clsA.id);
    const studA = await prisma.student.create({ data: { name: `StudA ${profB.testId}`, classId: clsA.id, organizationId: orgA.id } });
    registerStudent(studA.id);
    const justA = await prisma.absenceJustification.create({ data: { studentId: studA.id, date: new Date(), reason: "JustA", organizationId: orgA.id } });
    registerJustification(justA.id);

    const clsB = await prisma.class.create({ data: { name: `ClasseB ${profB.testId}`, organizationId: orgB.id, status: true } });
    registerClass(clsB.id);
    const csaB = await prisma.classStaffAssignment.create({
      data: { organizationId: orgB.id, classId: clsB.id, organizationMembershipId: profB.membership.id, assignmentRole: "PROFESSOR", active: true }
    });
    registerCsa(csaB.id);
    const studB = await prisma.student.create({ data: { name: `StudB ${profB.testId}`, classId: clsB.id, organizationId: orgB.id } });
    registerStudent(studB.id);
    const justB = await prisma.absenceJustification.create({ data: { studentId: studB.id, date: new Date(), reason: "JustB", organizationId: orgB.id } });
    registerJustification(justB.id);

    const lesA = await prisma.lesson.create({ data: { number: 1, title: "L33A", quarter: "2026-Q2", category: `ClasseA ${profB.testId}`, organizationId: orgA.id, classId: clsA.id } });
    registerLesson(lesA.id);
    const lesB = await prisma.lesson.create({ data: { number: 1, title: "L33B", quarter: "2026-Q2", category: `ClasseB ${profB.testId}`, organizationId: orgB.id, classId: clsB.id } });
    registerLesson(lesB.id);

    const notifA = await prisma.notification.create({ data: { title: "N33A", message: "MsgA", active: true, organizationId: orgA.id, userId: null } });
    registerNotification(notifA.id);
    const notifB = await prisma.notification.create({ data: { title: "N33B", message: "MsgB", active: true, organizationId: orgB.id, userId: null } });
    registerNotification(notifB.id);

    // 2. Tentar executar POST /api/auth/switch-org para a organização A (sem membership em orgA)
    const switchCheckRes = await fetch(`${baseUrl}/api/auth/switch-org`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: profB.cookies },
      body: JSON.stringify({ organizationId: orgA.id })
    });

    // 3. Confirmar HTTP status 403 e mensagem correspondente
    expect(switchCheckRes.status).toBe(403);
    const switchCheckData = await switchCheckRes.json();
    expect(switchCheckData.error).toContain("Você não possui acesso ativo a esta organização");

    // 4. Consultar GET /api/auth/session usando os cookies originais
    const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: profB.cookies }
    });
    expect(sessionRes.status).toBe(200);
    const sessionData = await sessionRes.json();

    // Confirmar que activeOrganizationId continua sendo orgB.id e nunca foi alterado para orgA.id
    expect(sessionData.user?.activeOrganizationId).toBe(orgB.id);
    expect(sessionData.user?.activeOrganizationId).not.toBe(orgA.id);

    // 5. Usando a sessão original da organização B, os 3 endpoints permanecem acessíveis conforme permissões de orgB
    const resJ = await fetch(`${baseUrl}/api/justifications`, { headers: { Cookie: profB.cookies } });
    expect(resJ.status).toBe(200);
    const dataJ = await resJ.json();
    expect(dataJ.some((j: any) => j.id === justB.id)).toBe(true);
    expect(dataJ.some((j: any) => j.id === justA.id)).toBe(false);

    const resL = await fetch(`${baseUrl}/api/lessons?quarter=2026-Q2`, { headers: { Cookie: profB.cookies } });
    expect(resL.status).toBe(200);
    const dataL = await resL.json();
    expect(dataL.some((l: any) => l.id === lesB.id)).toBe(true);
    expect(dataL.some((l: any) => l.id === lesA.id)).toBe(false);

    const resN = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: profB.cookies } });
    expect(resN.status).toBe(200);
    const dataN = await resN.json();
    expect(dataN.some((n: any) => n.id === notifB.id)).toBe(true);
    expect(dataN.some((n: any) => n.id === notifA.id)).toBe(false);
  });
});
