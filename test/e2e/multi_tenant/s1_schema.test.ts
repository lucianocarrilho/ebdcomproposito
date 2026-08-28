import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupTestUserAndLogin } from "../auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("S1: Schema ClassStaffAssignment Structural Validations", () => {
  let sede: any;
  let betel: any;

  let classSede1: any;
  let classSede2: any;
  let classBetel: any;

  let userProfSede: any;
  let userProfBetel: any;
  let userProfBilateral: any;

  let memProfSede: any;
  let memProfBetel: any;
  let memProfBilateralSede: any;
  let memProfBilateralBetel: any;

  // Cleanup tracking for auto-cleanup even if assertions fail
  let fixturesToCleanup: {
    csaIds: string[];
    classIds: string[];
    membershipIds: string[];
    userIds: string[];
    orgIds: string[];
  } = { csaIds: [], classIds: [], membershipIds: [], userIds: [], orgIds: [] };

  beforeAll(async () => {
    sede = await setupTestUserAndLogin("Sede Principal", "ADMIN");
    betel = await setupTestUserAndLogin("Betel", "ADMIN");

    userProfSede = await prisma.user.create({ data: { name: "Prof Sede", email: "test_prof_sede@test.com", password: "123", active: true } });
    memProfSede = await prisma.organizationMembership.create({ data: { userId: userProfSede.id, organizationId: sede.org.id, role: "PROFESSOR", status: "ACTIVE" } });

    userProfBetel = await prisma.user.create({ data: { name: "Prof Betel", email: "test_prof_betel@test.com", password: "123", active: true } });
    memProfBetel = await prisma.organizationMembership.create({ data: { userId: userProfBetel.id, organizationId: betel.org.id, role: "PROFESSOR", status: "ACTIVE" } });

    userProfBilateral = await prisma.user.create({ data: { name: "Prof Bilateral", email: "test_prof_bi@test.com", password: "123", active: true } });
    memProfBilateralSede = await prisma.organizationMembership.create({ data: { userId: userProfBilateral.id, organizationId: sede.org.id, role: "PROFESSOR", status: "ACTIVE" } });
    memProfBilateralBetel = await prisma.organizationMembership.create({ data: { userId: userProfBilateral.id, organizationId: betel.org.id, role: "PROFESSOR", status: "ACTIVE" } });

    classSede1 = await prisma.class.create({ data: { name: "Class Sede 1", organizationId: sede.org.id } });
    classSede2 = await prisma.class.create({ data: { name: "Class Sede 2", organizationId: sede.org.id } });
    classBetel = await prisma.class.create({ data: { name: "Class Betel 1", organizationId: betel.org.id } });
  }, 60_000);

  afterEach(async () => {
    // Robust auto-cleanup for anything pushed during individual tests
    if (fixturesToCleanup.csaIds.length > 0) {
      await prisma.classStaffAssignment.deleteMany({ where: { id: { in: fixturesToCleanup.csaIds } } });
    }
    if (fixturesToCleanup.classIds.length > 0) {
      await prisma.class.deleteMany({ where: { id: { in: fixturesToCleanup.classIds } } });
    }
    if (fixturesToCleanup.membershipIds.length > 0) {
      await prisma.organizationMembership.deleteMany({ where: { id: { in: fixturesToCleanup.membershipIds } } });
    }
    if (fixturesToCleanup.orgIds.length > 0) {
      await prisma.organization.deleteMany({ where: { id: { in: fixturesToCleanup.orgIds } } });
    }
    if (fixturesToCleanup.userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: fixturesToCleanup.userIds } } });
    }
    fixturesToCleanup = { csaIds: [], classIds: [], membershipIds: [], userIds: [], orgIds: [] };
  }, 60_000);

  afterAll(async () => {
    await prisma.classStaffAssignment.deleteMany({
      where: { classId: { in: [classSede1?.id, classSede2?.id, classBetel?.id].filter(Boolean) } }
    });
    await prisma.class.deleteMany({
      where: { id: { in: [classSede1?.id, classSede2?.id, classBetel?.id].filter(Boolean) } }
    });
    await prisma.organizationMembership.deleteMany({
      where: { userId: { in: [userProfSede?.id, userProfBetel?.id, userProfBilateral?.id].filter(Boolean) } }
    });
    await prisma.user.deleteMany({
      where: { email: { in: ["test_prof_sede@test.com", "test_prof_betel@test.com", "test_prof_bi@test.com", "test_temp@test.com", "test_org@test.com"] } }
    });
    if (betel) await betel.cleanup();
    if (sede) await sede.cleanup();
    await prisma.$disconnect();
  }, 60_000);

  it("1. vínculo válido dentro da mesma organização", async () => {
    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: sede.org.id, classId: classSede1.id, organizationMembershipId: memProfSede.id }
    });
    fixturesToCleanup.csaIds.push(csa.id);
    expect(csa.id).toBeDefined();
  });

  it("2. Class da Sede + Membership da Betel rejeitado pela foreign key", async () => {
    await expect(
      prisma.classStaffAssignment.create({
        data: { organizationId: sede.org.id, classId: classSede1.id, organizationMembershipId: memProfBetel.id }
      })
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("3. Class da Betel + Membership da Sede rejeitado", async () => {
    await expect(
      prisma.classStaffAssignment.create({
        data: { organizationId: betel.org.id, classId: classBetel.id, organizationMembershipId: memProfSede.id }
      })
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("4. organizationId divergente rejeitado", async () => {
    await expect(
      prisma.classStaffAssignment.create({
        data: { organizationId: betel.org.id, classId: classSede1.id, organizationMembershipId: memProfSede.id }
      })
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("5. duplicação Class + Membership rejeitada", async () => {
    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: sede.org.id, classId: classSede1.id, organizationMembershipId: memProfSede.id }
    });
    fixturesToCleanup.csaIds.push(csa.id);

    await expect(
      prisma.classStaffAssignment.create({
        data: { organizationId: sede.org.id, classId: classSede1.id, organizationMembershipId: memProfSede.id }
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("6. Mesma pessoa em duas Classes da mesma organização permitida", async () => {
    const csa1 = await prisma.classStaffAssignment.create({
      data: { organizationId: sede.org.id, classId: classSede1.id, organizationMembershipId: memProfSede.id }
    });
    const csa2 = await prisma.classStaffAssignment.create({
      data: { organizationId: sede.org.id, classId: classSede2.id, organizationMembershipId: memProfSede.id }
    });
    fixturesToCleanup.csaIds.push(csa1.id, csa2.id);
    expect(csa1.id).toBeDefined();
    expect(csa2.id).toBeDefined();
  });

  it("7. a mesma pessoa, por memberships diferentes, em Sede e Betel permitida", async () => {
    const csaSede = await prisma.classStaffAssignment.create({
      data: { organizationId: sede.org.id, classId: classSede1.id, organizationMembershipId: memProfBilateralSede.id }
    });
    const csaBetel = await prisma.classStaffAssignment.create({
      data: { organizationId: betel.org.id, classId: classBetel.id, organizationMembershipId: memProfBilateralBetel.id }
    });
    fixturesToCleanup.csaIds.push(csaSede.id, csaBetel.id);
    expect(csaSede.id).toBeDefined();
    expect(csaBetel.id).toBeDefined();
  });

  it("8. PROFESSOR e AUXILIAR persistidos corretamente", async () => {
    const csaProf = await prisma.classStaffAssignment.create({
      data: { organizationId: sede.org.id, classId: classSede1.id, organizationMembershipId: memProfSede.id, assignmentRole: "PROFESSOR" }
    });
    const csaAux = await prisma.classStaffAssignment.create({
      data: { organizationId: sede.org.id, classId: classSede2.id, organizationMembershipId: memProfSede.id, assignmentRole: "AUXILIAR" }
    });
    fixturesToCleanup.csaIds.push(csaProf.id, csaAux.id);
    expect(csaProf.assignmentRole).toBe("PROFESSOR");
    expect(csaAux.assignmentRole).toBe("AUXILIAR");
  });

  it("9. active=false permitido no Assignment", async () => {
    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: sede.org.id, classId: classSede1.id, organizationMembershipId: memProfSede.id, active: false }
    });
    fixturesToCleanup.csaIds.push(csa.id);
    expect(csa.active).toBe(false);
  });

  it("10. Exclusão direta da Class remove seus Assignments", async () => {
    const tempClass = await prisma.class.create({ data: { name: "Temp Class", organizationId: sede.org.id } });
    fixturesToCleanup.classIds.push(tempClass.id);
    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: sede.org.id, classId: tempClass.id, organizationMembershipId: memProfSede.id }
    });
    fixturesToCleanup.csaIds.push(csa.id);
    await prisma.class.delete({ where: { id: tempClass.id } });
    const checkCsa = await prisma.classStaffAssignment.findUnique({ where: { id: csa.id } });
    expect(checkCsa).toBeNull();
  });

  it("11. Exclusão direta de OrganizationMembership remove seus Assignments", async () => {
    const tempUser = await prisma.user.create({ data: { name: "Temp", email: "test_temp@test.com", password: "123", active: true } });
    fixturesToCleanup.userIds.push(tempUser.id);
    const memTemp = await prisma.organizationMembership.create({ data: { userId: tempUser.id, organizationId: sede.org.id, role: "PROFESSOR", status: "ACTIVE" } });
    fixturesToCleanup.membershipIds.push(memTemp.id);
    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: sede.org.id, classId: classSede1.id, organizationMembershipId: memTemp.id }
    });
    fixturesToCleanup.csaIds.push(csa.id);
    await prisma.organizationMembership.delete({ where: { id: memTemp.id } });
    const checkCsa = await prisma.classStaffAssignment.findUnique({ where: { id: csa.id } });
    expect(checkCsa).toBeNull();
  });

  // --- S1b Tests ---

  it("12. Criação de Class sem organizationId rejeitada pelo banco (via QueryRaw para bypass TS)", async () => {
    expect.assertions(2);
    try {
      await prisma.$executeRaw`INSERT INTO classes (id, name, updatedAt, organizationId) VALUES ('fake-id-123', 'Sem Org', NOW(), NULL)`;
    } catch (e: any) {
      expect(e.code).toBe("P2010");
      expect(e.message).toMatch(/cannot be null|1048/i);
    }
  });

  it("13. Class com organizationId inexistente rejeitada", async () => {
    await expect(
      prisma.class.create({
        data: { name: "Fake Org", organizationId: "fake-id" }
      })
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("14. Exclusão direta de Organization contendo Class é rejeitada por P2003 (RESTRICT) e preserva dados", async () => {
    expect.assertions(6);
    const timestamp = Date.now();
    const org = await prisma.organization.create({ data: { name: "Test Org", slug: "test-org-" + timestamp } });
    fixturesToCleanup.orgIds.push(org.id);
    const tempUser = await prisma.user.create({ data: { name: "Temp Org", email: "test_org_" + timestamp + "@test.com", password: "123" } });
    fixturesToCleanup.userIds.push(tempUser.id);
    const memTemp = await prisma.organizationMembership.create({ data: { userId: tempUser.id, organizationId: org.id } });
    fixturesToCleanup.membershipIds.push(memTemp.id);
    const cls = await prisma.class.create({ data: { name: "Test Org Class", organizationId: org.id } });
    fixturesToCleanup.classIds.push(cls.id);
    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: org.id, classId: cls.id, organizationMembershipId: memTemp.id }
    });
    fixturesToCleanup.csaIds.push(csa.id);

    try {
      await prisma.organization.delete({ where: { id: org.id } });
    } catch (e: any) {
      expect(e.code).toBe("P2003");
      expect(e.message).toContain("organizationId");
    }

    const checkOrg = await prisma.organization.findUnique({ where: { id: org.id } });
    const checkCls = await prisma.class.findUnique({ where: { id: cls.id } });
    const checkMem = await prisma.organizationMembership.findUnique({ where: { id: memTemp.id } });
    const checkCsa = await prisma.classStaffAssignment.findUnique({ where: { id: csa.id } });

    expect(checkOrg).not.toBeNull();
    expect(checkCls).not.toBeNull();
    expect(checkMem).not.toBeNull();
    expect(checkCsa).not.toBeNull();
  });

  it("15. active=false em Organization preserva tudo", async () => {
    const timestamp = Date.now() + 1;
    const org = await prisma.organization.create({ data: { name: "Test Org2", slug: "test-org2-" + timestamp } });
    fixturesToCleanup.orgIds.push(org.id);
    const tempUser = await prisma.user.create({ data: { name: "Temp Org2", email: "test_org2_" + timestamp + "@test.com", password: "123" } });
    fixturesToCleanup.userIds.push(tempUser.id);
    const memTemp = await prisma.organizationMembership.create({ data: { userId: tempUser.id, organizationId: org.id } });
    fixturesToCleanup.membershipIds.push(memTemp.id);
    const cls = await prisma.class.create({ data: { name: "Test Org Class", organizationId: org.id } });
    fixturesToCleanup.classIds.push(cls.id);
    const csa = await prisma.classStaffAssignment.create({
      data: { organizationId: org.id, classId: cls.id, organizationMembershipId: memTemp.id }
    });
    fixturesToCleanup.csaIds.push(csa.id);

    await prisma.organization.update({ where: { id: org.id }, data: { active: false } });

    const checkOrg = await prisma.organization.findUnique({ where: { id: org.id } });
    const checkCls = await prisma.class.findUnique({ where: { id: cls.id } });
    const checkMem = await prisma.organizationMembership.findUnique({ where: { id: memTemp.id } });
    const checkCsa = await prisma.classStaffAssignment.findUnique({ where: { id: csa.id } });
    expect(checkOrg?.active).toBe(false);
    expect(checkCls).not.toBeNull();
    expect(checkMem).not.toBeNull();
    expect(checkCsa).not.toBeNull();
  });

  it("16. Nenhuma Class com organizationId nulo e zero fixtures de csa no final", async () => {
    const nullClasses = await prisma.$queryRaw`SELECT count(*) as cnt FROM classes WHERE organizationId IS NULL`;
    expect(Number((nullClasses as any)[0].cnt)).toBe(0);

    const remaining = await prisma.classStaffAssignment.count();
    expect(remaining).toBe(0);
  });
});
