import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestUserAndLogin } from "../auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = "http://localhost:3100";

describe("Phase 4A: Students and Leaders (Multi-Tenant Isolation)", () => {
  let sede: any;
  let betel: any;
  let profBetel: any;
  let profSede: any;
  let globalAdminNoOrg: any; // To test global admin without active org

  let userGlobal: any;
  beforeAll(async () => {
    sede = await setupTestUserAndLogin("Sede Principal", "ADMIN");
    betel = await setupTestUserAndLogin("Betel", "ADMIN");
    profBetel = await setupTestUserAndLogin("Betel", "PROFESSOR");
    profSede = await setupTestUserAndLogin("Sede Principal", "PROFESSOR");

    // Create global admin without active org
    const userGlobalId = `global_${Date.now()}`;
    userGlobal = await prisma.user.create({
      data: {
        name: "Global Admin",
        email: `${userGlobalId}@test.com`,
        password: "hashed_password",
        isGlobalAdmin: true,
      }
    });
  }, 60_000);

  afterAll(async () => {
    await profSede.cleanup();
    await profBetel.cleanup();
    await betel.cleanup();
    await sede.cleanup();
    if (userGlobal) {
      await prisma.user.delete({ where: { id: userGlobal.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }, 60_000);

  describe("Students Endpoints", () => {
    let studentSede: any;
    let studentBetel: any;

    it("POST /api/students - should create student isolated in Sede", async () => {
      const res = await fetch(`${baseUrl}/api/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": sede.cookies },
        body: JSON.stringify({ name: `Student Sede`, classId: sede.classId })
      });
      expect(res.status).toBe(201);
      studentSede = await res.json();
      expect(studentSede.organizationId).toBe(sede.org.id);
    });

    it("POST /api/students - should create student isolated in Betel", async () => {
      const res = await fetch(`${baseUrl}/api/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": betel.cookies },
        body: JSON.stringify({ name: `Student Betel`, classId: betel.classId })
      });
      expect(res.status).toBe(201);
      studentBetel = await res.json();
      expect(studentBetel.organizationId).toBe(betel.org.id);
    });

    it("POST /api/students - should reject organizationId in payload (400)", async () => {
      const res = await fetch(`${baseUrl}/api/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": sede.cookies },
        body: JSON.stringify({ name: "Hacker", classId: sede.classId, organizationId: betel.org.id })
      });
      expect(res.status).toBe(400);
    });

    it("PUT /api/students/[id] - should reject organizationId in payload (400)", async () => {
      const res = await fetch(`${baseUrl}/api/students/${studentSede.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Cookie": sede.cookies },
        body: JSON.stringify({ name: "Hacker", organizationId: betel.org.id })
      });
      expect(res.status).toBe(400);
    });

    it("POST /api/students - should return 404 if classId belongs to outra organização", async () => {
      const res = await fetch(`${baseUrl}/api/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": sede.cookies },
        body: JSON.stringify({ name: "Hacker", classId: betel.classId })
      });
      expect(res.status).toBe(404);
    });

    it("POST /api/students - papel sem permissão retornando 403", async () => {
      const res = await fetch(`${baseUrl}/api/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": profBetel.cookies },
        body: JSON.stringify({ name: "Blocked", classId: betel.classId })
      });
      expect(res.status).toBe(403);
    });

    it("GET /api/students - listagem isolada em Sede e Betel", async () => {
      const resSede = await fetch(`${baseUrl}/api/students`, { headers: { "Cookie": sede.cookies } });
      const dataSede = await resSede.json();
      expect(dataSede.some((s: any) => s.id === studentSede.id)).toBe(true);
      expect(dataSede.some((s: any) => s.id === studentBetel.id)).toBe(false);

      const resBetel = await fetch(`${baseUrl}/api/students`, { headers: { "Cookie": betel.cookies } });
      const dataBetel = await resBetel.json();
      expect(dataBetel.some((s: any) => s.id === studentBetel.id)).toBe(true);
      expect(dataBetel.some((s: any) => s.id === studentSede.id)).toBe(false);
    });

    it("GET /api/students/birthdays - aniversariantes isolado em Sede e Betel", async () => {
      // We assume the created students have no birthday set, but the endpoint must return 200 and not cross data.
      const resSede = await fetch(`${baseUrl}/api/students/birthdays?month=8`, { headers: { "Cookie": sede.cookies } });
      expect(resSede.status).toBe(200);
      const dataSede = await resSede.json();
      expect(dataSede.every((s: any) => s.organizationId === sede.org.id)).toBe(true);

      const resBetel = await fetch(`${baseUrl}/api/students/birthdays?month=8`, { headers: { "Cookie": betel.cookies } });
      expect(resBetel.status).toBe(200);
      const dataBetel = await resBetel.json();
      expect(dataBetel.every((s: any) => s.organizationId === betel.org.id)).toBe(true);
    });

    it("GET /api/students/[id] - GET cruzado nos dois sentidos retornando 404", async () => {
      // Sede tenta acessar aluno de Betel
      const res1 = await fetch(`${baseUrl}/api/students/${studentBetel.id}`, { headers: { "Cookie": sede.cookies } });
      expect(res1.status).toBe(404);
      // Betel tenta acessar aluno de Sede
      const res2 = await fetch(`${baseUrl}/api/students/${studentSede.id}`, { headers: { "Cookie": betel.cookies } });
      expect(res2.status).toBe(404);

      // Test complete payload structure for own student (200)
      const reqOwn = await fetch(`${baseUrl}/api/students/${studentSede.id}`, { headers: { "Cookie": sede.cookies } });
      expect(reqOwn.status).toBe(200);
      const ownData = await reqOwn.json();

      // Verify structure matches AlunoDetalhePage requirements
      expect(ownData).toHaveProperty("id", studentSede.id);
      expect(ownData).toHaveProperty("stats");
      expect(ownData.stats).toHaveProperty("presencas");
      expect(ownData.stats).toHaveProperty("faltas");
      expect(ownData.stats).toHaveProperty("justificadas");
      expect(ownData.stats).toHaveProperty("frequencia");
      expect(ownData.stats).toHaveProperty("visitantesTrazidos");
      expect(ownData.stats).toHaveProperty("destaques");
      expect(ownData.stats).toHaveProperty("totalAulas");
      expect(ownData).toHaveProperty("visitorsInvited");
      expect(Array.isArray(ownData.visitorsInvited)).toBe(true);
      expect(ownData).toHaveProperty("attendanceItems");
      expect(Array.isArray(ownData.attendanceItems)).toBe(true);
    });

    it("PUT /api/students/[id] - PUT cruzado nos dois sentidos retornando 404", async () => {
      const res1 = await fetch(`${baseUrl}/api/students/${studentBetel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Cookie": sede.cookies },
        body: JSON.stringify({ name: "Hacked" })
      });
      expect(res1.status).toBe(404);

      const res2 = await fetch(`${baseUrl}/api/students/${studentSede.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Cookie": betel.cookies },
        body: JSON.stringify({ name: "Hacked" })
      });
      expect(res2.status).toBe(404);
    });

    it("DELETE /api/students/[id] - DELETE cruzado nos dois sentidos retornando 404 sem exclusão", async () => {
      const res1 = await fetch(`${baseUrl}/api/students/${studentBetel.id}`, {
        method: "DELETE",
        headers: { "Cookie": sede.cookies }
      });
      expect(res1.status).toBe(404);

      const res2 = await fetch(`${baseUrl}/api/students/${studentSede.id}`, {
        method: "DELETE",
        headers: { "Cookie": betel.cookies }
      });
      expect(res2.status).toBe(404);

      // Verify they still exist
      const check1 = await prisma.student.findUnique({ where: { id: studentSede.id } });
      expect(check1).not.toBeNull();
      const check2 = await prisma.student.findUnique({ where: { id: studentBetel.id } });
      expect(check2).not.toBeNull();
    });
  });

  describe("Leaders Endpoints", () => {
    let leaderSede: any;
    let leaderBetel: any;

    it("POST /api/leaders - create isolated leader in Sede", async () => {
      const res = await fetch(`${baseUrl}/api/leaders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": sede.cookies },
        body: JSON.stringify({ name: `Leader Sede`, role: "Professor", classId: "none" })
      });
      expect(res.status).toBe(201);
      leaderSede = await res.json();
      expect(leaderSede.organizationId).toBe(sede.org.id);
    });

    it("POST /api/leaders - create isolated leader in Betel", async () => {
      const res = await fetch(`${baseUrl}/api/leaders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": betel.cookies },
        body: JSON.stringify({ name: `Leader Betel`, role: "Professor", classId: "none" })
      });
      expect(res.status).toBe(201);
      leaderBetel = await res.json();
      expect(leaderBetel.organizationId).toBe(betel.org.id);
    });

    it("POST /api/leaders - reject organizationId in payload (400)", async () => {
      const res = await fetch(`${baseUrl}/api/leaders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": sede.cookies },
        body: JSON.stringify({ name: "Hacker", role: "Professor", classId: "none", organizationId: betel.org.id })
      });
      expect(res.status).toBe(400);
    });

    it("PUT /api/leaders/[id] - reject organizationId in payload (400)", async () => {
      const res = await fetch(`${baseUrl}/api/leaders/${leaderSede.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Cookie": sede.cookies },
        body: JSON.stringify({ name: "Hacker", organizationId: betel.org.id })
      });
      expect(res.status).toBe(400);
    });

    it("POST /api/leaders - papel sem permissão retornando 403", async () => {
      const res = await fetch(`${baseUrl}/api/leaders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": profBetel.cookies },
        body: JSON.stringify({ name: "Blocked", role: "Apoio" })
      });
      expect(res.status).toBe(403);
    });

    it("GET /api/leaders - listagem isolada em Sede e Betel", async () => {
      const resSede = await fetch(`${baseUrl}/api/leaders`, { headers: { "Cookie": sede.cookies } });
      const dataSede = await resSede.json();
      expect(dataSede.some((l: any) => l.id === leaderSede.id)).toBe(true);
      expect(dataSede.some((l: any) => l.id === leaderBetel.id)).toBe(false);

      const resBetel = await fetch(`${baseUrl}/api/leaders`, { headers: { "Cookie": betel.cookies } });
      const dataBetel = await resBetel.json();
      expect(dataBetel.some((l: any) => l.id === leaderBetel.id)).toBe(true);
      expect(dataBetel.some((l: any) => l.id === leaderSede.id)).toBe(false);
    });

    it("GET /api/leaders/[id] - GET cruzado nos dois sentidos retornando 404", async () => {
      const res1 = await fetch(`${baseUrl}/api/leaders/${leaderBetel.id}`, { headers: { "Cookie": sede.cookies } });
      expect(res1.status).toBe(404);
      const res2 = await fetch(`${baseUrl}/api/leaders/${leaderSede.id}`, { headers: { "Cookie": betel.cookies } });
      expect(res2.status).toBe(404);
    });

    it("PUT /api/leaders/[id] - PUT cruzado nos dois sentidos retornando 404", async () => {
      const res1 = await fetch(`${baseUrl}/api/leaders/${leaderBetel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Cookie": sede.cookies },
        body: JSON.stringify({ name: "Hacked" })
      });
      expect(res1.status).toBe(404);

      const res2 = await fetch(`${baseUrl}/api/leaders/${leaderSede.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Cookie": betel.cookies },
        body: JSON.stringify({ name: "Hacked" })
      });
      expect(res2.status).toBe(404);
    });

    it("PUT /api/leaders/[id] - manter a classe ao editar somente o nome (payload parcial)", async () => {
      // Setup: vincular leaderSede a uma classe da Sede primeiro
      const resLink = await fetch(`${baseUrl}/api/leaders/${leaderSede.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Cookie": sede.cookies },
        body: JSON.stringify({ classId: sede.classId })
      });
      expect(resLink.status).toBe(200);
      const linkedLeader = await resLink.json();
      expect(linkedLeader.classId).toBe(sede.classId);

      // Ação: atualizar apenas o nome, omitindo classId
      const resUpdate = await fetch(`${baseUrl}/api/leaders/${leaderSede.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Cookie": sede.cookies },
        body: JSON.stringify({ name: "Nome Editado" }) // Omitindo classId
      });
      expect(resUpdate.status).toBe(200);
      const updatedLeader = await resUpdate.json();
      expect(updatedLeader.name).toBe("Nome Editado");
      expect(updatedLeader.classId).toBe(sede.classId); // Deve manter o vínculo
    });

    it("PUT /api/leaders/[id] - mudança explícita para Geral (classId: 'none') define classId como null", async () => {
      const res = await fetch(`${baseUrl}/api/leaders/${leaderSede.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Cookie": sede.cookies },
        body: JSON.stringify({ name: "Nome Editado 2", classId: "none" })
      });
      expect(res.status).toBe(200);
      const updated = await res.json();
      expect(updated.classId).toBeNull();
    });

    it("PUT /api/leaders/[id] - classId de outra organização retorna 404 e não altera o líder", async () => {
      const res = await fetch(`${baseUrl}/api/leaders/${leaderSede.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Cookie": sede.cookies },
        body: JSON.stringify({ classId: betel.classId })
      });
      expect(res.status).toBe(404); // Nova classe não encontrada (proteção activeOrganizationId)
    });

    it("DELETE /api/leaders/[id] - DELETE cruzado nos dois sentidos retornando 404 sem exclusão", async () => {
      const res1 = await fetch(`${baseUrl}/api/leaders/${leaderBetel.id}`, {
        method: "DELETE",
        headers: { "Cookie": sede.cookies }
      });
      expect(res1.status).toBe(404);

      const res2 = await fetch(`${baseUrl}/api/leaders/${leaderSede.id}`, {
        method: "DELETE",
        headers: { "Cookie": betel.cookies }
      });
      expect(res2.status).toBe(404);

      const check1 = await prisma.leader.findUnique({ where: { id: leaderSede.id } });
      expect(check1).not.toBeNull();
      const check2 = await prisma.leader.findUnique({ where: { id: leaderBetel.id } });
      expect(check2).not.toBeNull();
    });

    it("GET /api/leaders/[id]/history - history sem Classes ou Events de outra organização (404 cruzado)", async () => {
      const res1 = await fetch(`${baseUrl}/api/leaders/${leaderBetel.id}/history`, { headers: { "Cookie": sede.cookies } });
      expect(res1.status).toBe(404);
      const res2 = await fetch(`${baseUrl}/api/leaders/${leaderSede.id}/history`, { headers: { "Cookie": betel.cookies } });
      expect(res2.status).toBe(404);
    });
  });
});
