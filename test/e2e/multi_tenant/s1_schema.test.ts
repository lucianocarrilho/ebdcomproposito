import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

  beforeAll(async () => {
    sede = await setupTestUserAndLogin("Sede Principal", "ADMIN");
    betel = await setupTestUserAndLogin("Betel", "ADMIN");

    // profSede is just in Sede
    userProfSede = await prisma.user.create({ data: { name: "Prof Sede", email: "test_prof_sede@test.com", password: "123", active: true } });
    memProfSede = await prisma.organizationMembership.create({ data: { userId: userProfSede.id, organizationId: sede.org.id, role: "PROFESSOR", status: "ACTIVE" } });
    
    // profBetel is just in Betel
    userProfBetel = await prisma.user.create({ data: { name: "Prof Betel", email: "test_prof_betel@test.com", password: "123", active: true } });
    memProfBetel = await prisma.organizationMembership.create({ data: { userId: userProfBetel.id, organizationId: betel.org.id, role: "PROFESSOR", status: "ACTIVE" } });

    // profBilateral is in both
    userProfBilateral = await prisma.user.create({ data: { name: "Prof Bilateral", email: "test_prof_bi@test.com", password: "123", active: true } });
    memProfBilateralSede = await prisma.organizationMembership.create({ data: { userId: userProfBilateral.id, organizationId: sede.org.id, role: "PROFESSOR", status: "ACTIVE" } });
    memProfBilateralBetel = await prisma.organizationMembership.create({ data: { userId: userProfBilateral.id, organizationId: betel.org.id, role: "PROFESSOR", status: "ACTIVE" } });

    // Create Classes
    classSede1 = await prisma.class.create({
      data: { name: "Class Sede 1", organizationId: sede.org.id }
    });
    classSede2 = await prisma.class.create({
      data: { name: "Class Sede 2", organizationId: sede.org.id }
    });
    classBetel = await prisma.class.create({
      data: { name: "Class Betel 1", organizationId: betel.org.id }
    });
  }, 60_000);

  afterAll(async () => {
    await prisma.class.deleteMany({
      where: { id: { in: [classSede1?.id, classSede2?.id, classBetel?.id].filter(Boolean) } }
    });

    await prisma.user.deleteMany({
      where: { email: { in: ["test_prof_sede@test.com", "test_prof_betel@test.com", "test_prof_bi@test.com", "test_temp@test.com"] } }
    });

    if (betel) await betel.cleanup();
    if (sede) await sede.cleanup();

    await prisma.$disconnect();
  }, 60_000);

  it("1. vínculo válido dentro da mesma organização", async () => {
    const csa = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sede.org.id,
        classId: classSede1.id,
        organizationMembershipId: memProfSede.id,
      }
    });

    expect(csa.id).toBeDefined();
    await prisma.classStaffAssignment.delete({ where: { id: csa.id } });
  });

  it("2. Class da Sede + Membership da Betel rejeitado pela foreign key", async () => {
    await expect(prisma.classStaffAssignment.create({
      data: {
        organizationId: sede.org.id,
        classId: classSede1.id,
        organizationMembershipId: memProfBetel.id, // Membership is from Betel!
      }
    })).rejects.toThrow(); // Foreign key violation
  });

  it("3. Class da Betel + Membership da Sede rejeitado", async () => {
    await expect(prisma.classStaffAssignment.create({
      data: {
        organizationId: betel.org.id,
        classId: classBetel.id,
        organizationMembershipId: memProfSede.id, // Membership is from Sede!
      }
    })).rejects.toThrow(); // Foreign key violation
  });

  it("4. organizationId divergente rejeitado", async () => {
    await expect(prisma.classStaffAssignment.create({
      data: {
        organizationId: betel.org.id, // Divergent org id
        classId: classSede1.id,
        organizationMembershipId: memProfSede.id,
      }
    })).rejects.toThrow(); // Foreign key violation
  });

  it("5. duplicação Class + Membership rejeitada", async () => {
    const csa = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sede.org.id,
        classId: classSede1.id,
        organizationMembershipId: memProfSede.id,
      }
    });

    await expect(prisma.classStaffAssignment.create({
      data: {
        organizationId: sede.org.id,
        classId: classSede1.id,
        organizationMembershipId: memProfSede.id,
      }
    })).rejects.toThrow(); // Unique constraint violation

    await prisma.classStaffAssignment.delete({ where: { id: csa.id } });
  });

  it("6. mesma Membership em duas Classes da mesma organização permitida", async () => {
    const csa1 = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sede.org.id,
        classId: classSede1.id,
        organizationMembershipId: memProfSede.id,
      }
    });

    const csa2 = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sede.org.id,
        classId: classSede2.id,
        organizationMembershipId: memProfSede.id,
      }
    });

    expect(csa1.id).toBeDefined();
    expect(csa2.id).toBeDefined();

    await prisma.classStaffAssignment.deleteMany({ where: { id: { in: [csa1.id, csa2.id] } } });
  });

  it("7. a mesma pessoa, por memberships diferentes, em Sede e Betel permitida", async () => {
    const csaSede = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sede.org.id,
        classId: classSede1.id,
        organizationMembershipId: memProfBilateralSede.id,
      }
    });

    const csaBetel = await prisma.classStaffAssignment.create({
      data: {
        organizationId: betel.org.id,
        classId: classBetel.id,
        organizationMembershipId: memProfBilateralBetel.id,
      }
    });

    expect(csaSede.id).toBeDefined();
    expect(csaBetel.id).toBeDefined();

    await prisma.classStaffAssignment.deleteMany({ where: { id: { in: [csaSede.id, csaBetel.id] } } });
  });

  it("8. PROFESSOR e AUXILIAR persistidos corretamente", async () => {
    const csaProf = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sede.org.id,
        classId: classSede1.id,
        organizationMembershipId: memProfSede.id,
        assignmentRole: "PROFESSOR"
      }
    });

    const csaAux = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sede.org.id,
        classId: classSede2.id,
        organizationMembershipId: memProfSede.id,
        assignmentRole: "AUXILIAR"
      }
    });

    expect(csaProf.assignmentRole).toBe("PROFESSOR");
    expect(csaAux.assignmentRole).toBe("AUXILIAR");

    await prisma.classStaffAssignment.deleteMany({ where: { id: { in: [csaProf.id, csaAux.id] } } });
  });

  it("9. active=false permitido", async () => {
    const csa = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sede.org.id,
        classId: classSede1.id,
        organizationMembershipId: memProfSede.id,
        active: false
      }
    });

    expect(csa.active).toBe(false);

    await prisma.classStaffAssignment.delete({ where: { id: csa.id } });
  });

  it("10. exclusão da Class remove sua atribuição", async () => {
    const tempClass = await prisma.class.create({
      data: { name: "Temp Class", organizationId: sede.org.id }
    });

    const csa = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sede.org.id,
        classId: tempClass.id,
        organizationMembershipId: memProfSede.id,
      }
    });

    await prisma.class.delete({ where: { id: tempClass.id } });

    const checkCsa = await prisma.classStaffAssignment.findUnique({ where: { id: csa.id } });
    expect(checkCsa).toBeNull();
  });

  it("11. exclusão da Membership remove sua atribuição", async () => {
    const tempUser = await prisma.user.create({ data: { name: "Temp", email: "test_temp@test.com", password: "123", active: true } });
    const memTemp = await prisma.organizationMembership.create({ data: { userId: tempUser.id, organizationId: sede.org.id, role: "PROFESSOR", status: "ACTIVE" } });
    
    const csa = await prisma.classStaffAssignment.create({
      data: {
        organizationId: sede.org.id,
        classId: classSede1.id,
        organizationMembershipId: memTemp.id,
      }
    });

    // Delete membership directly (or cleanup the user which cascades to membership)
    await prisma.user.delete({ where: { id: tempUser.id } });

    const checkCsa = await prisma.classStaffAssignment.findUnique({ where: { id: csa.id } });
    expect(checkCsa).toBeNull();
  });

  it("12. zero fixtures após cada execução", async () => {
    const remaining = await prisma.classStaffAssignment.count();
    expect(remaining).toBe(0);
  });
});
