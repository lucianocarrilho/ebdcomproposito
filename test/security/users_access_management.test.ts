/**
 * test/security/users_access_management.test.ts
 * Suíte de testes de segurança e validação para Gestão de Acessos via OrganizationMembership:
 * - Validações puras e resolveSessionActiveRole
 * - GET /api/profile
 * - GET /api/users (escopo estrito de activeOrganizationId + orgRole ADMIN, sem vazar usuários globais / Admin Global sem vínculo)
 * - POST /api/users (usuário + membership na mesma transação, vínculo de e-mail existente sem alterar senha, reativação INACTIVE, bloqueio 409 duplicidade)
 * - PUT/PATCH /api/users/[id] (edição de role na congregação, proteção de credenciais de usuário compartilhado/Global Admin, 404 cross-org)
 * - DELETE /api/users/[id] (inativação apenas do membership/atribuições da congregação atual, preservando User global)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockRequireAuth,
  mockRequireOrganization,
  mockBcryptHash,
  mockTx,
  mockPrisma,
} = vi.hoisted(() => {
  const tx = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organizationMembership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    classStaffAssignment: {
      updateMany: vi.fn(),
    },
  };

  return {
    mockRequireAuth: vi.fn(),
    mockRequireOrganization: vi.fn(),
    mockBcryptHash: vi.fn(),
    mockTx: tx,
    mockPrisma: {
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      organizationMembership: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      classStaffAssignment: {
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/permissions", () => ({
  requireAuth: mockRequireAuth,
  requireOrganization: mockRequireOrganization,
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: mockBcryptHash,
    compare: vi.fn(),
  },
  hash: mockBcryptHash,
}));

import {
  parseCreateUserAccessInput,
  parseUpdateUserAccessInput,
  resolveSessionActiveRole,
} from "@/lib/user-access-validation";
import { GET as getProfile } from "@/app/api/profile/route";
import { GET as listUsers, POST as createUserAccess } from "@/app/api/users/route";
import {
  PUT as updateUserAccess,
  PATCH as patchUserAccess,
  DELETE as removeUserAccess,
} from "@/app/api/users/[id]/route";

function makeOrgContext(overrides?: Partial<{
  userId: string;
  activeOrganizationId: string;
  orgRole: string;
  isGlobalAdmin: boolean;
  globalAdminMode: boolean;
}>) {
  return {
    session: { user: { id: overrides?.userId ?? "usr-admin-1" } },
    user: {
      id: overrides?.userId ?? "usr-admin-1",
      email: "admin@org.com",
      role: overrides?.orgRole ?? "ADMIN",
      isGlobalAdmin: overrides?.isGlobalAdmin ?? false,
      globalAdminMode: overrides?.globalAdminMode ?? false,
      activeOrganizationId: overrides?.activeOrganizationId ?? "org-1",
    },
    activeOrganizationId: overrides?.activeOrganizationId ?? "org-1",
    orgRole: overrides?.orgRole ?? "ADMIN",
    membership: overrides?.globalAdminMode ? null : { id: "mem-admin-1" },
    isGlobalAdmin: overrides?.isGlobalAdmin ?? false,
    globalAdminMode: overrides?.globalAdminMode ?? false,
  };
}

function makeMembershipRow(overrides?: Partial<{
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  status: string;
  name: string;
  email: string;
  image: string | null;
  birthDate: Date | null;
  isGlobalAdmin: boolean;
  active: boolean;
  membershipCount: number;
}>) {
  return {
    id: overrides?.id ?? "mem-1",
    userId: overrides?.userId ?? "usr-1",
    organizationId: overrides?.organizationId ?? "org-1",
    role: overrides?.role ?? "ADMIN",
    status: overrides?.status ?? "ACTIVE",
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
    user: {
      id: overrides?.userId ?? "usr-1",
      name: overrides?.name ?? "Gestor Teste",
      email: overrides?.email ?? "gestor@congregacao.com",
      image: overrides?.image ?? null,
      birthDate: overrides?.birthDate ?? null,
      isGlobalAdmin: overrides?.isGlobalAdmin ?? false,
      active: overrides?.active ?? true,
      _count: {
        memberships: overrides?.membershipCount ?? 1,
      },
    },
  };
}

describe("Gestão de Acessos — Segurança, Whitelist e OrganizationMembership", () => {
  beforeEach(() => {
    mockBcryptHash.mockResolvedValue("$2b$10$hashed_password_mock");
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)
    );
  });

  describe("1. Validações puras e resolução de perfil ativo", () => {
    it("rejeita campos proibidos no payload de criação e atualização", () => {
      const badCreate = parseCreateUserAccessInput({
        name: "Usuário Teste",
        email: "Teste@Igreja.com",
        password: "Password123!",
        role: "ADMIN",
        isGlobalAdmin: true,
      });
      expect(badCreate.valid).toBe(false);

      const badUpdate = parseUpdateUserAccessInput({
        role: "ADMIN",
        organizationId: "org-outra",
      });
      expect(badUpdate.valid).toBe(false);

      const badStatusUpdate = parseUpdateUserAccessInput({
        role: "ADMIN",
        active: false,
        status: "INACTIVE",
      });
      expect(badStatusUpdate.valid).toBe(false);
    });

    it("normaliza e-mail e valida role/imagem/data", () => {
      const parsed = parseCreateUserAccessInput({
        name: "  Maria   Silva  ",
        email: "  Maria@Congregacao.COM ",
        password: "Password123!",
        role: "VICE_DIRIGENTE",
      });
      expect(parsed).toEqual({
        valid: true,
        data: {
          name: "Maria   Silva",
          email: "maria@congregacao.com",
          password: "Password123!",
          role: "VICE_DIRIGENTE",
        },
      });

      expect(
        parseCreateUserAccessInput({
          email: "maria@teste.com",
          role: "SUPER_ADMIN",
        }).valid
      ).toBe(false);

      expect(
        parseCreateUserAccessInput({
          email: "maria@teste.com",
          role: "ADMIN",
          image: "javascript:alert(1)",
        }).valid
      ).toBe(false);
    });

    it("resolveSessionActiveRole prioriza globalAdminMode e role da congregação ativa", () => {
      expect(
        resolveSessionActiveRole({
          role: "PROFESSOR",
          isGlobalAdmin: true,
          globalAdminMode: true,
          activeOrganizationId: "org-2",
          memberships: [{ organizationId: "org-1", role: "PROFESSOR" }],
        })
      ).toBe("ADMIN");

      expect(
        resolveSessionActiveRole({
          role: "PROFESSOR",
          isGlobalAdmin: false,
          globalAdminMode: false,
          activeOrganizationId: "org-2",
          memberships: [
            { organizationId: "org-1", role: "PROFESSOR" },
            { organizationId: "org-2", role: "ADMIN" },
          ],
        })
      ).toBe("ADMIN");
    });
  });

  describe("2. GET /api/profile", () => {
    it("retorna 401 sem autenticação e retorna apenas dados do próprio usuário ativo", async () => {
      mockRequireAuth.mockResolvedValueOnce({
        error: "Não autorizado",
        status: 401,
      });
      const unauth = await getProfile();
      expect(unauth.status).toBe(401);

      mockRequireAuth.mockResolvedValueOnce({
        session: { user: { id: "usr-self" } },
        user: { id: "usr-self" },
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "usr-self",
        name: "Professor Próprio",
        email: "prof@org.com",
        image: "https://blob.example/avatar.jpg",
        active: true,
      });

      const ok = await getProfile();
      expect(ok.status).toBe(200);
      const body = await ok.json();
      expect(body).toEqual({
        id: "usr-self",
        name: "Professor Próprio",
        email: "prof@org.com",
        image: "https://blob.example/avatar.jpg",
      });
    });
  });

  describe("3. GET /api/users", () => {
    it("exige organização ativa e perfil ADMIN na congregação", async () => {
      mockRequireOrganization.mockResolvedValueOnce({
        error: "Não autorizado",
        status: 401,
      });
      expect((await listUsers()).status).toBe(401);

      mockRequireOrganization.mockResolvedValueOnce({
        error: "Organização não selecionada",
        status: 403,
      });
      expect((await listUsers()).status).toBe(403);

      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({ orgRole: "PROFESSOR" })
      );
      expect((await listUsers()).status).toBe(403);
    });

    it("consulta apenas OrganizationMembership ativo da congregação atual (não vaza globais/Admin Global sem vínculo)", async () => {
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({
          activeOrganizationId: "org-iv-dires",
          orgRole: "ADMIN",
          isGlobalAdmin: true,
          globalAdminMode: true,
        })
      );
      mockPrisma.organizationMembership.findMany.mockResolvedValueOnce([]);

      const res = await listUsers();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.organizationMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: "org-iv-dires",
            status: "ACTIVE",
            user: { active: true },
          },
        })
      );
    });
  });

  describe("4. POST /api/users", () => {
    it("cria User + OrganizationMembership ACTIVE na mesma transação usando activeOrganizationId", async () => {
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({
          activeOrganizationId: "org-iv-dires",
          isGlobalAdmin: true,
          globalAdminMode: true,
        })
      );
      mockTx.user.findUnique.mockResolvedValueOnce(null);
      mockTx.user.create.mockResolvedValueOnce({ id: "usr-new-1" });
      mockTx.organizationMembership.create.mockResolvedValueOnce(
        makeMembershipRow({
          id: "mem-new-1",
          userId: "usr-new-1",
          organizationId: "org-iv-dires",
          role: "ADMIN",
          name: "Admin IV Dires",
          email: "admin.iv@ebd.com",
        })
      );

      const req = new NextRequest("http://localhost/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Admin IV Dires",
          email: "ADMIN.IV@EBD.COM",
          password: "Password123!",
          role: "ADMIN",
        }),
      });

      const res = await createUserAccess(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data).toMatchObject({
        id: "usr-new-1",
        membershipId: "mem-new-1",
        organizationId: "org-iv-dires",
        role: "ADMIN",
        status: "ACTIVE",
        linkedExistingUser: false,
      });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "admin.iv@ebd.com",
            isGlobalAdmin: false,
            active: true,
          }),
        })
      );
      expect(mockTx.organizationMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: "usr-new-1",
            organizationId: "org-iv-dires",
            role: "ADMIN",
            status: "ACTIVE",
          },
        })
      );
    });

    it("propaga erro da transação se criação do membership falhar (sem criar usuário órfão fora da transação)", async () => {
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({ activeOrganizationId: "org-iv-dires" })
      );
      mockTx.user.findUnique.mockResolvedValueOnce(null);
      mockTx.user.create.mockResolvedValueOnce({ id: "usr-orphan" });
      mockTx.organizationMembership.create.mockRejectedValueOnce(
        new Error("DB_FAILURE_MEMBERSHIP")
      );

      const req = new NextRequest("http://localhost/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Teste Rollback",
          email: "rollback@ebd.com",
          password: "Password123!",
          role: "ADMIN",
        }),
      });

      const res = await createUserAccess(req);
      expect(res.status).toBe(500);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it("vincula usuário existente sem duplicar user e sem alterar senha", async () => {
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({ activeOrganizationId: "org-b" })
      );
      mockTx.user.findUnique.mockResolvedValueOnce({
        id: "usr-existing-a",
        active: true,
      });
      mockTx.organizationMembership.findUnique.mockResolvedValueOnce(null);
      mockTx.organizationMembership.create.mockResolvedValueOnce(
        makeMembershipRow({
          id: "mem-b-1",
          userId: "usr-existing-a",
          organizationId: "org-b",
          role: "DIRIGENTE",
          email: "multi@ebd.com",
          membershipCount: 2,
        })
      );

      const req = new NextRequest("http://localhost/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Nome Ignorado",
          email: "multi@ebd.com",
          password: "NovaSenhaTentativa999!",
          role: "DIRIGENTE",
        }),
      });

      const res = await createUserAccess(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.linkedExistingUser).toBe(true);
      expect(data.role).toBe("DIRIGENTE");
      expect(mockTx.user.create).not.toHaveBeenCalled();
      expect(mockTx.user.update).not.toHaveBeenCalled();
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });

    it("reativa membership INACTIVE na congregação atual sem alterar usuário e bloqueia ACTIVE duplicado com 409", async () => {
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({ activeOrganizationId: "org-b" })
      );
      mockTx.user.findUnique.mockResolvedValueOnce({
        id: "usr-existing-b",
        active: true,
      });
      mockTx.organizationMembership.findUnique.mockResolvedValueOnce({
        id: "mem-inactive-1",
        status: "INACTIVE",
      });
      mockTx.organizationMembership.update.mockResolvedValueOnce(
        makeMembershipRow({
          id: "mem-inactive-1",
          userId: "usr-existing-b",
          organizationId: "org-b",
          role: "PROFESSOR",
          status: "ACTIVE",
        })
      );

      const reactivateRes = await createUserAccess(
        new NextRequest("http://localhost/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "reativar@ebd.com",
            role: "PROFESSOR",
          }),
        })
      );
      expect(reactivateRes.status).toBe(201);
      expect(mockTx.organizationMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id_organizationId: {
              id: "mem-inactive-1",
              organizationId: "org-b",
            },
          },
          data: { status: "ACTIVE", role: "PROFESSOR" },
        })
      );

      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({ activeOrganizationId: "org-b" })
      );
      mockTx.user.findUnique.mockResolvedValueOnce({
        id: "usr-existing-b",
        active: true,
      });
      mockTx.organizationMembership.findUnique.mockResolvedValueOnce({
        id: "mem-active-1",
        status: "ACTIVE",
      });

      const dupRes = await createUserAccess(
        new NextRequest("http://localhost/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "reativar@ebd.com",
            role: "ADMIN",
          }),
        })
      );
      expect(dupRes.status).toBe(409);
    });
  });

  describe("5. PUT/PATCH & DELETE /api/users/[id]", () => {
    it("retorna 404 ao tentar editar ou remover vínculo de outra congregação", async () => {
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({ activeOrganizationId: "org-a" })
      );
      mockTx.organizationMembership.findFirst.mockResolvedValueOnce(null);

      const putCross = await updateUserAccess(
        new NextRequest("http://localhost/api/users/mem-org-b", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "APOIO" }),
        }),
        { params: Promise.resolve({ id: "mem-org-b" }) }
      );
      expect(putCross.status).toBe(404);

      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({ activeOrganizationId: "org-a" })
      );
      mockTx.organizationMembership.findFirst.mockResolvedValueOnce(null);

      const delCross = await removeUserAccess(
        new NextRequest("http://localhost/api/users/mem-org-b", {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: "mem-org-b" }) }
      );
      expect(delCross.status).toBe(404);
    });

    it("permite alterar role de usuário compartilhado apenas na congregação atual e bloqueia alteração de senha/e-mail global com 403", async () => {
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({ activeOrganizationId: "org-a" })
      );
      mockTx.organizationMembership.findFirst.mockResolvedValueOnce(
        makeMembershipRow({
          id: "mem-shared-a",
          userId: "usr-shared",
          organizationId: "org-a",
          role: "APOIO",
          name: "Líder Multi",
          email: "lider@ebd.com",
          membershipCount: 2,
        })
      );
      mockTx.organizationMembership.update.mockResolvedValueOnce(
        makeMembershipRow({
          id: "mem-shared-a",
          userId: "usr-shared",
          organizationId: "org-a",
          role: "DIRIGENTE",
          name: "Líder Multi",
          email: "lider@ebd.com",
          membershipCount: 2,
        })
      );

      const patchRoleRes = await patchUserAccess(
        new NextRequest("http://localhost/api/users/mem-shared-a", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Líder Multi",
            email: "lider@ebd.com",
            role: "DIRIGENTE",
          }),
        }),
        { params: Promise.resolve({ id: "mem-shared-a" }) }
      );
      expect(patchRoleRes.status).toBe(200);
      expect((await patchRoleRes.json()).role).toBe("DIRIGENTE");
      expect(mockTx.user.update).not.toHaveBeenCalled();

      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({ activeOrganizationId: "org-a" })
      );
      mockTx.organizationMembership.findFirst.mockResolvedValueOnce(
        makeMembershipRow({
          id: "mem-shared-a",
          userId: "usr-shared",
          organizationId: "org-a",
          role: "DIRIGENTE",
          name: "Líder Multi",
          email: "lider@ebd.com",
          membershipCount: 2,
        })
      );

      const hijackedPasswordRes = await updateUserAccess(
        new NextRequest("http://localhost/api/users/mem-shared-a", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "DIRIGENTE",
            password: "HijackPassword123!",
          }),
        }),
        { params: Promise.resolve({ id: "mem-shared-a" }) }
      );
      expect(hijackedPasswordRes.status).toBe(403);
      expect(mockTx.user.update).not.toHaveBeenCalled();
    });

    it("DELETE inativa apenas membership e atribuições da congregação atual sem desativar/excluir User", async () => {
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({
          userId: "usr-admin-1",
          activeOrganizationId: "org-a",
        })
      );
      mockTx.organizationMembership.findFirst.mockResolvedValueOnce({
        id: "mem-target-a",
        userId: "usr-shared",
        organizationId: "org-a",
      });
      mockTx.classStaffAssignment.updateMany.mockResolvedValueOnce({ count: 1 });
      mockTx.organizationMembership.update.mockResolvedValueOnce({
        id: "mem-target-a",
        status: "INACTIVE",
      });

      const delRes = await removeUserAccess(
        new NextRequest("http://localhost/api/users/mem-target-a", {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: "mem-target-a" }) }
      );
      expect(delRes.status).toBe(200);
      expect(mockTx.classStaffAssignment.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-a",
          organizationMembershipId: "mem-target-a",
          active: true,
        },
        data: { active: false },
      });
      expect(mockTx.organizationMembership.update).toHaveBeenCalledWith({
        where: {
          id_organizationId: {
            id: "mem-target-a",
            organizationId: "org-a",
          },
        },
        data: { status: "INACTIVE" },
      });
      expect(mockTx.user.update).not.toHaveBeenCalled();
      expect(mockTx.user.delete).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it("bloqueia auto-remoção de administrador local com 400 quando há outro ADMIN na congregação", async () => {
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({
          userId: "usr-self-admin",
          activeOrganizationId: "org-a",
          isGlobalAdmin: false,
        })
      );
      mockTx.organizationMembership.findFirst.mockResolvedValueOnce({
        id: "mem-self-admin",
        userId: "usr-self-admin",
        organizationId: "org-a",
        role: "ADMIN",
      });
      mockTx.organizationMembership.count.mockResolvedValueOnce(2);

      const selfDelRes = await removeUserAccess(
        new NextRequest("http://localhost/api/users/mem-self-admin", {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: "mem-self-admin" }) }
      );
      expect(selfDelRes.status).toBe(400);
      expect(mockTx.organizationMembership.update).not.toHaveBeenCalled();
    });

    it("impede PUT e PATCH de rebaixar o último ADMIN ativo da congregação (409), inclusive auto-rebaixamento, usando transação Serializable", async () => {
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({
          userId: "usr-global",
          activeOrganizationId: "org-iv-dires",
          isGlobalAdmin: true,
          globalAdminMode: true,
        })
      );
      mockTx.organizationMembership.findFirst.mockResolvedValueOnce(
        makeMembershipRow({
          id: "mem-sole-admin",
          userId: "usr-sole-admin",
          organizationId: "org-iv-dires",
          role: "ADMIN",
          name: "Único Admin",
          email: "unico@ivdires.com",
        })
      );
      mockTx.organizationMembership.count.mockResolvedValueOnce(1);

      const putDemoteRes = await updateUserAccess(
        new NextRequest("http://localhost/api/users/mem-sole-admin", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "DIRIGENTE" }),
        }),
        { params: Promise.resolve({ id: "mem-sole-admin" }) }
      );
      expect(putDemoteRes.status).toBe(409);
      expect((await putDemoteRes.json()).error).toBe(
        "Não é possível rebaixar o último administrador ativo desta congregação."
      );
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: "Serializable" }
      );
      expect(mockTx.organizationMembership.count).toHaveBeenCalledWith({
        where: {
          organizationId: "org-iv-dires",
          status: "ACTIVE",
          role: "ADMIN",
          user: { active: true },
        },
      });
      expect(mockTx.organizationMembership.update).not.toHaveBeenCalled();

      // Auto-rebaixamento via PATCH pelo próprio último ADMIN
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({
          userId: "usr-sole-admin",
          activeOrganizationId: "org-iv-dires",
          isGlobalAdmin: false,
        })
      );
      mockTx.organizationMembership.findFirst.mockResolvedValueOnce(
        makeMembershipRow({
          id: "mem-sole-admin",
          userId: "usr-sole-admin",
          organizationId: "org-iv-dires",
          role: "ADMIN",
          name: "Único Admin",
          email: "unico@ivdires.com",
        })
      );
      mockTx.organizationMembership.count.mockResolvedValueOnce(1);

      const selfPatchDemoteRes = await patchUserAccess(
        new NextRequest("http://localhost/api/users/mem-sole-admin", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "PROFESSOR" }),
        }),
        { params: Promise.resolve({ id: "mem-sole-admin" }) }
      );
      expect(selfPatchDemoteRes.status).toBe(409);
      expect(mockTx.organizationMembership.update).not.toHaveBeenCalled();

      // Manter role === ADMIN ao atualizar outros campos continua permitido
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({
          userId: "usr-sole-admin",
          activeOrganizationId: "org-iv-dires",
        })
      );
      mockTx.organizationMembership.findFirst.mockResolvedValueOnce(
        makeMembershipRow({
          id: "mem-sole-admin",
          userId: "usr-sole-admin",
          organizationId: "org-iv-dires",
          role: "ADMIN",
          name: "Único Admin",
          email: "unico@ivdires.com",
        })
      );
      mockTx.user.update.mockResolvedValueOnce({ id: "usr-sole-admin" });
      mockTx.organizationMembership.update.mockResolvedValueOnce(
        makeMembershipRow({
          id: "mem-sole-admin",
          userId: "usr-sole-admin",
          organizationId: "org-iv-dires",
          role: "ADMIN",
          name: "Único Admin Atualizado",
          email: "unico@ivdires.com",
        })
      );

      const keepAdminRes = await patchUserAccess(
        new NextRequest("http://localhost/api/users/mem-sole-admin", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Único Admin Atualizado",
            role: "ADMIN",
          }),
        }),
        { params: Promise.resolve({ id: "mem-sole-admin" }) }
      );
      expect(keepAdminRes.status).toBe(200);
      expect(mockTx.organizationMembership.count).toHaveBeenCalledTimes(2);
    });

    it("impede DELETE de remover o último ADMIN ativo (409), inclusive auto-remoção ou via Admin Global", async () => {
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({
          userId: "usr-global",
          activeOrganizationId: "org-iv-dires",
          isGlobalAdmin: true,
          globalAdminMode: true,
        })
      );
      mockTx.organizationMembership.findFirst.mockResolvedValueOnce({
        id: "mem-sole-admin",
        userId: "usr-sole-admin",
        organizationId: "org-iv-dires",
        role: "ADMIN",
      });
      mockTx.organizationMembership.count.mockResolvedValueOnce(1);

      const globalDelRes = await removeUserAccess(
        new NextRequest("http://localhost/api/users/mem-sole-admin", {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: "mem-sole-admin" }) }
      );
      expect(globalDelRes.status).toBe(409);
      expect((await globalDelRes.json()).error).toBe(
        "Não é possível remover o último administrador ativo desta congregação."
      );
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: "Serializable" }
      );
      expect(mockTx.classStaffAssignment.updateMany).not.toHaveBeenCalled();
      expect(mockTx.organizationMembership.update).not.toHaveBeenCalled();

      // Auto-remoção quando é o último ADMIN retorna 409 (proteção prevalece sobre 400)
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({
          userId: "usr-sole-admin",
          activeOrganizationId: "org-iv-dires",
          isGlobalAdmin: false,
        })
      );
      mockTx.organizationMembership.findFirst.mockResolvedValueOnce({
        id: "mem-sole-admin",
        userId: "usr-sole-admin",
        organizationId: "org-iv-dires",
        role: "ADMIN",
      });
      mockTx.organizationMembership.count.mockResolvedValueOnce(1);

      const selfSoleDelRes = await removeUserAccess(
        new NextRequest("http://localhost/api/users/mem-sole-admin", {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: "mem-sole-admin" }) }
      );
      expect(selfSoleDelRes.status).toBe(409);
      expect(mockTx.organizationMembership.update).not.toHaveBeenCalled();
    });

    it("permite rebaixar ou remover ADMIN quando há >= 2 ADMINs ativos na congregação e retorna 409 em P2034", async () => {
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({
          userId: "usr-admin-1",
          activeOrganizationId: "org-iv-dires",
        })
      );
      mockTx.organizationMembership.findFirst.mockResolvedValueOnce(
        makeMembershipRow({
          id: "mem-admin-2",
          userId: "usr-admin-2",
          organizationId: "org-iv-dires",
          role: "ADMIN",
          name: "Segundo Admin",
          email: "segundo@ivdires.com",
        })
      );
      mockTx.organizationMembership.count.mockResolvedValueOnce(2);
      mockTx.user.update.mockResolvedValueOnce({ id: "usr-admin-2" });
      mockTx.organizationMembership.update.mockResolvedValueOnce(
        makeMembershipRow({
          id: "mem-admin-2",
          userId: "usr-admin-2",
          organizationId: "org-iv-dires",
          role: "APOIO",
          name: "Segundo Admin",
          email: "segundo@ivdires.com",
        })
      );

      const demoteWhenTwoRes = await putOrPatchDemoteCheck();
      expect(demoteWhenTwoRes.status).toBe(200);

      // Conflito de serialização P2034 retorna 409 em PUT e DELETE
      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({ activeOrganizationId: "org-iv-dires" })
      );
      mockPrisma.$transaction.mockRejectedValueOnce({ code: "P2034" });

      const putP2034Res = await updateUserAccess(
        new NextRequest("http://localhost/api/users/mem-admin-2", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "APOIO" }),
        }),
        { params: Promise.resolve({ id: "mem-admin-2" }) }
      );
      expect(putP2034Res.status).toBe(409);

      mockRequireOrganization.mockResolvedValueOnce(
        makeOrgContext({ activeOrganizationId: "org-iv-dires" })
      );
      mockPrisma.$transaction.mockRejectedValueOnce({ code: "P2034" });

      const delP2034Res = await removeUserAccess(
        new NextRequest("http://localhost/api/users/mem-admin-2", {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: "mem-admin-2" }) }
      );
      expect(delP2034Res.status).toBe(409);

      async function putOrPatchDemoteCheck() {
        return updateUserAccess(
          new NextRequest("http://localhost/api/users/mem-admin-2", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "APOIO" }),
          }),
          { params: Promise.resolve({ id: "mem-admin-2" }) }
        );
      }
    });
  });
});
