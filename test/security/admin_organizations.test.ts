/**
 * test/security/admin_organizations.test.ts
 * Suíte de testes de segurança e validação (mocks puros, zero banco de dados):
 * - requireGlobalAdmin() e middleware /admin
 * - Validações puras de Organization (whitelist, limites, slug)
 * - GET /api/admin/organizations
 * - POST /api/admin/organizations
 * - PATCH /api/admin/organizations/[id]
 * - DELETE /api/admin/organizations/[id] (bloqueado com 405)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockAuth, mockRedirect, mockTx, mockPrisma } = vi.hoisted(() => {
  const tx = {
    organization: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    mockAuth: vi.fn(),
    mockRedirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    mockTx: tx,
    mockPrisma: {
      user: {
        findUnique: vi.fn(),
      },
      organization: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { middleware } from "@/middleware";
import { requireGlobalAdmin } from "@/lib/permissions";
import {
  ORG_NAME_MAX_LENGTH,
  ORG_SLUG_MAX_LENGTH,
  parseCreateOrganizationInput,
  parseUpdateOrganizationInput,
  suggestOrganizationSlug,
} from "@/lib/organization-validation";
import { GET, POST } from "@/app/api/admin/organizations/route";
import { PATCH, DELETE } from "@/app/api/admin/organizations/[id]/route";

function createGlobalAdminSession(overrides?: {
  id?: string;
  isGlobalAdmin?: boolean;
}) {
  return {
    user: {
      id: overrides?.id ?? "usr-global-1",
      name: "Admin Global",
      email: "global@ebd.com",
      isGlobalAdmin: overrides?.isGlobalAdmin ?? true,
    },
    expires: "2099-01-01T00:00:00.000Z",
  };
}

function makeOrgRecord(overrides?: Partial<{
  id: string;
  name: string;
  slug: string;
  active: boolean;
}>) {
  return {
    id: overrides?.id ?? "org-1",
    name: overrides?.name ?? "Sede Principal",
    slug: overrides?.slug ?? "sede-principal",
    active: overrides?.active ?? true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    _count: {
      memberships: 3,
      classes: 5,
      students: 40,
    },
  };
}

describe("Admin Organizations — Segurança, Validação e Regras de Negócio", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockRedirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });

    mockPrisma.user.findUnique.mockReset();
    mockPrisma.organization.findMany.mockReset();
    mockPrisma.organization.findUnique.mockReset();
    mockPrisma.organization.findFirst.mockReset();
    mockPrisma.organization.count.mockReset();
    mockPrisma.organization.create.mockReset();
    mockPrisma.organization.update.mockReset();
    mockPrisma.organization.delete.mockReset();
    mockPrisma.organization.deleteMany.mockReset();

    mockTx.organization.findUnique.mockReset();
    mockTx.organization.findFirst.mockReset();
    mockTx.organization.count.mockReset();
    mockTx.organization.update.mockReset();

    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)
    );
  });

  describe("1. Middleware e requireGlobalAdmin()", () => {
    it("deve redirecionar usuário anônimo em /admin e /admin/organizations para /", () => {
      const reqAdmin = new NextRequest("http://localhost:3000/admin");
      const resAdmin = middleware(reqAdmin);
      expect(resAdmin.status).toBe(307);
      expect(resAdmin.headers.get("location")).toBe("http://localhost:3000/");

      const reqOrgs = new NextRequest(
        "http://localhost:3000/admin/organizations"
      );
      const resOrgs = middleware(reqOrgs);
      expect(resOrgs.status).toBe(307);
      expect(resOrgs.headers.get("location")).toBe("http://localhost:3000/");
    });

    it("deve retornar 401 no middleware para /api/admin/organizations sem cookie", () => {
      const reqApi = new NextRequest(
        "http://localhost:3000/api/admin/organizations"
      );
      const resApi = middleware(reqApi);
      expect(resApi.status).toBe(401);
    });

    it("deve permitir passagem no middleware para /admin/organizations com cookie de sessão", () => {
      const reqOrgs = new NextRequest(
        "http://localhost:3000/admin/organizations",
        {
          headers: { cookie: "authjs.session-token=dummy-token" },
        }
      );
      const resOrgs = middleware(reqOrgs);
      expect(resOrgs.status).toBe(200);
    });

    it("requireGlobalAdmin(false) redireciona anônimo para /", async () => {
      mockAuth.mockResolvedValue(null);
      await expect(requireGlobalAdmin(false)).rejects.toThrow(
        "NEXT_REDIRECT:/"
      );
    });

    it("requireGlobalAdmin(false) redireciona não-GlobalAdmin para /select-organization", async () => {
      mockAuth.mockResolvedValue(
        createGlobalAdminSession({ isGlobalAdmin: false })
      );
      await expect(requireGlobalAdmin(false)).rejects.toThrow(
        "NEXT_REDIRECT:/select-organization"
      );
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("requireGlobalAdmin(false) redireciona Global Admin inativo no banco para /select-organization", async () => {
      mockAuth.mockResolvedValue(createGlobalAdminSession());
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-global-1",
        active: false,
        isGlobalAdmin: true,
      });

      await expect(requireGlobalAdmin(false)).rejects.toThrow(
        "NEXT_REDIRECT:/select-organization"
      );
    });

    it("requireGlobalAdmin(false) redireciona usuário que perdeu isGlobalAdmin no banco para /select-organization", async () => {
      mockAuth.mockResolvedValue(createGlobalAdminSession());
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-global-1",
        active: true,
        isGlobalAdmin: false,
      });

      await expect(requireGlobalAdmin(false)).rejects.toThrow(
        "NEXT_REDIRECT:/select-organization"
      );
    });
  });

  describe("2. Validações puras de payload e slug", () => {
    it("deve sugerir slug minúsculo sem acentos ou caracteres inválidos", () => {
      expect(suggestOrganizationSlug("Congregação Sede 1 — São José")).toBe(
        "congregacao-sede-1-sao-jose"
      );
      expect(suggestOrganizationSlug("  ---Filial   Norte--- ")).toBe(
        "filial-norte"
      );
    });

    it("deve rejeitar slugs inválidos (maiúsculas, acentos, espaços, símbolos)", () => {
      for (const badSlug of [
        "",
        " ",
        "a",
        "Sede",
        "sede sul",
        "congregação",
        "sede_sul",
        "-sede",
        "sede-",
        "sede--sul",
        "a".repeat(ORG_SLUG_MAX_LENGTH + 1),
      ]) {
        const res = parseCreateOrganizationInput({
          name: "Congregação Válida",
          slug: badSlug,
        });
        expect(res.valid).toBe(false);
      }
    });

    it("deve rejeitar nomes vazios após trim ou acima do limite do schema", () => {
      expect(
        parseCreateOrganizationInput({ name: "   ", slug: "sede-1" }).valid
      ).toBe(false);
      expect(
        parseCreateOrganizationInput({ name: "A", slug: "sede-1" }).valid
      ).toBe(false);
      expect(
        parseCreateOrganizationInput({
          name: "A".repeat(ORG_NAME_MAX_LENGTH + 1),
          slug: "sede-1",
        }).valid
      ).toBe(false);
    });

    it("deve rejeitar campos fora da whitelist (id, createdAt, updatedAt, extras)", () => {
      for (const extraField of [
        { id: "org-hacked" },
        { createdAt: "2026-01-01" },
        { updatedAt: "2026-01-01" },
        { organizationId: "org-2" },
        { arbitrary: true },
      ]) {
        const createRes = parseCreateOrganizationInput({
          name: "Congregação Teste",
          slug: "congregacao-teste",
          ...extraField,
        });
        expect(createRes.valid).toBe(false);

        const updateRes = parseUpdateOrganizationInput({
          name: "Congregação Teste",
          ...extraField,
        });
        expect(updateRes.valid).toBe(false);
      }
    });
  });

  describe("3. GET /api/admin/organizations", () => {
    it("deve retornar 401 para anônimo", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("deve retornar 403 para usuário que não é Global Admin", async () => {
      mockAuth.mockResolvedValue(
        createGlobalAdminSession({ isGlobalAdmin: false })
      );
      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("deve retornar 403 para Global Admin inativo no banco", async () => {
      mockAuth.mockResolvedValue(createGlobalAdminSession());
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-global-1",
        active: false,
        isGlobalAdmin: true,
      });

      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("deve retornar 403 para Global Admin que perdeu isGlobalAdmin no banco", async () => {
      mockAuth.mockResolvedValue(createGlobalAdminSession());
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-global-1",
        active: true,
        isGlobalAdmin: false,
      });

      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("deve retornar 403 quando usuário não existe mais no banco", async () => {
      mockAuth.mockResolvedValue(createGlobalAdminSession());
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("deve listar congregações ativas e inativas para Global Admin válido", async () => {
      mockAuth.mockResolvedValue(createGlobalAdminSession());
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-global-1",
        active: true,
        isGlobalAdmin: true,
      });
      const records = [
        makeOrgRecord({ id: "org-1", name: "Sede", slug: "sede", active: true }),
        makeOrgRecord({ id: "org-2", name: "Betel", slug: "betel", active: false }),
      ];
      mockPrisma.organization.findMany.mockResolvedValue(records);

      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(2);
      expect(body[0].slug).toBe("sede");
      expect(body[1].active).toBe(false);
    });
  });

  describe("4. POST /api/admin/organizations", () => {
    function setupValidGlobalAdmin() {
      mockAuth.mockResolvedValue(createGlobalAdminSession());
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-global-1",
        active: true,
        isGlobalAdmin: true,
      });
    }

    it("deve retornar 401 para anônimo", async () => {
      mockAuth.mockResolvedValue(null);
      const req = new NextRequest(
        "http://localhost:3000/api/admin/organizations",
        {
          method: "POST",
          body: JSON.stringify({ name: "Betel", slug: "betel" }),
        }
      );
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("deve retornar 403 para usuário que não é Global Admin", async () => {
      mockAuth.mockResolvedValue(
        createGlobalAdminSession({ isGlobalAdmin: false })
      );
      const req = new NextRequest(
        "http://localhost:3000/api/admin/organizations",
        {
          method: "POST",
          body: JSON.stringify({ name: "Betel", slug: "betel" }),
        }
      );
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("deve retornar 403 para Global Admin inativo ou revogado no banco", async () => {
      mockAuth.mockResolvedValue(createGlobalAdminSession());
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-global-1",
        active: true,
        isGlobalAdmin: false,
      });
      const req = new NextRequest(
        "http://localhost:3000/api/admin/organizations",
        {
          method: "POST",
          body: JSON.stringify({ name: "Betel", slug: "betel" }),
        }
      );
      const res = await POST(req);
      expect(res.status).toBe(403);
      expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    });

    it("deve retornar 400 para JSON malformado ou payload inválido (whitelist, nome vazio, slug inválido)", async () => {
      setupValidGlobalAdmin();

      const badJsonReq = new NextRequest(
        "http://localhost:3000/api/admin/organizations",
        { method: "POST", body: "{not-json" }
      );
      expect((await POST(badJsonReq)).status).toBe(400);

      const extraFieldReq = new NextRequest(
        "http://localhost:3000/api/admin/organizations",
        {
          method: "POST",
          body: JSON.stringify({
            id: "custom-id",
            name: "Congregação Nova",
            slug: "congregacao-nova",
          }),
        }
      );
      expect((await POST(extraFieldReq)).status).toBe(400);

      const badSlugReq = new NextRequest(
        "http://localhost:3000/api/admin/organizations",
        {
          method: "POST",
          body: JSON.stringify({
            name: "Congregação Nova",
            slug: "Congregação Nova",
          }),
        }
      );
      expect((await POST(badSlugReq)).status).toBe(400);
      expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    });

    it("deve retornar 409 quando slug já existir no banco", async () => {
      setupValidGlobalAdmin();
      mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-existing" });

      const req = new NextRequest(
        "http://localhost:3000/api/admin/organizations",
        {
          method: "POST",
          body: JSON.stringify({ name: "Betel", slug: "betel" }),
        }
      );
      const res = await POST(req);
      expect(res.status).toBe(409);
      expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    });

    it("deve retornar 409 quando Prisma lançar erro P2002 de unicidade", async () => {
      setupValidGlobalAdmin();
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      mockPrisma.organization.create.mockRejectedValue({ code: "P2002" });

      const req = new NextRequest(
        "http://localhost:3000/api/admin/organizations",
        {
          method: "POST",
          body: JSON.stringify({ name: "Betel", slug: "betel" }),
        }
      );
      const res = await POST(req);
      expect(res.status).toBe(409);
    });

    it("deve criar congregação com sucesso (201) aplicando trim e whitelist", async () => {
      setupValidGlobalAdmin();
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      const created = makeOrgRecord({
        id: "org-new",
        name: "Congregação Betel",
        slug: "congregacao-betel",
      });
      mockPrisma.organization.create.mockResolvedValue(created);

      const req = new NextRequest(
        "http://localhost:3000/api/admin/organizations",
        {
          method: "POST",
          body: JSON.stringify({
            name: "  Congregação Betel  ",
            slug: "congregacao-betel",
          }),
        }
      );
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(mockPrisma.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: "Congregação Betel",
            slug: "congregacao-betel",
            active: true,
          },
        })
      );
    });
  });

  describe("5. PATCH /api/admin/organizations/[id]", () => {
    function setupValidGlobalAdmin() {
      mockAuth.mockResolvedValue(createGlobalAdminSession());
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-global-1",
        active: true,
        isGlobalAdmin: true,
      });
    }

    it("deve retornar 401 para anônimo e 403 para não-Global Admin ou revogado", async () => {
      mockAuth.mockResolvedValue(null);
      const reqAnon = new NextRequest(
        "http://localhost:3000/api/admin/organizations/org-1",
        { method: "PATCH", body: JSON.stringify({ name: "Novo" }) }
      );
      expect(
        (await PATCH(reqAnon, { params: Promise.resolve({ id: "org-1" }) }))
          .status
      ).toBe(401);

      mockAuth.mockResolvedValue(
        createGlobalAdminSession({ isGlobalAdmin: false })
      );
      const reqNonGlobal = new NextRequest(
        "http://localhost:3000/api/admin/organizations/org-1",
        { method: "PATCH", body: JSON.stringify({ name: "Novo" }) }
      );
      expect(
        (
          await PATCH(reqNonGlobal, {
            params: Promise.resolve({ id: "org-1" }),
          })
        ).status
      ).toBe(403);

      mockAuth.mockResolvedValue(createGlobalAdminSession());
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-global-1",
        active: false,
        isGlobalAdmin: true,
      });
      const reqInactive = new NextRequest(
        "http://localhost:3000/api/admin/organizations/org-1",
        { method: "PATCH", body: JSON.stringify({ name: "Novo" }) }
      );
      expect(
        (
          await PATCH(reqInactive, {
            params: Promise.resolve({ id: "org-1" }),
          })
        ).status
      ).toBe(403);
    });

    it("deve retornar 400 para payload inválido, vazio ou com campos proibidos", async () => {
      setupValidGlobalAdmin();

      for (const body of [
        {},
        { id: "org-2", name: "Teste" },
        { createdAt: "2026-01-01" },
        { updatedAt: "2026-01-01" },
        { name: " " },
        { slug: "Slug Invalido" },
        { active: "false" },
      ]) {
        const req = new NextRequest(
          "http://localhost:3000/api/admin/organizations/org-1",
          { method: "PATCH", body: JSON.stringify(body) }
        );
        const res = await PATCH(req, {
          params: Promise.resolve({ id: "org-1" }),
        });
        expect(res.status).toBe(400);
      }
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("deve retornar 404 para organização inexistente", async () => {
      setupValidGlobalAdmin();
      mockTx.organization.findUnique.mockResolvedValue(null);

      const req = new NextRequest(
        "http://localhost:3000/api/admin/organizations/org-missing",
        { method: "PATCH", body: JSON.stringify({ name: "Sede Editada" }) }
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "org-missing" }),
      });
      expect(res.status).toBe(404);
      expect(mockTx.organization.update).not.toHaveBeenCalled();
    });

    it("deve editar nome e slug mantendo validação de unicidade", async () => {
      setupValidGlobalAdmin();
      mockTx.organization.findUnique.mockResolvedValue({
        id: "org-1",
        slug: "sede-antiga",
        active: true,
      });
      mockTx.organization.findFirst.mockResolvedValue(null);
      mockTx.organization.update.mockResolvedValue(
        makeOrgRecord({
          id: "org-1",
          name: "Sede Renovada",
          slug: "sede-renovada",
        })
      );

      const req = new NextRequest(
        "http://localhost:3000/api/admin/organizations/org-1",
        {
          method: "PATCH",
          body: JSON.stringify({
            name: "  Sede Renovada  ",
            slug: "sede-renovada",
          }),
        }
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "org-1" }),
      });
      expect(res.status).toBe(200);
      expect(mockTx.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "org-1" },
          data: { name: "Sede Renovada", slug: "sede-renovada" },
        })
      );
    });

    it("deve retornar 409 ao tentar alterar slug para um slug já existente", async () => {
      setupValidGlobalAdmin();
      mockTx.organization.findUnique.mockResolvedValue({
        id: "org-1",
        slug: "sede-1",
        active: true,
      });
      mockTx.organization.findFirst.mockResolvedValue({ id: "org-2" });

      const req = new NextRequest(
        "http://localhost:3000/api/admin/organizations/org-1",
        { method: "PATCH", body: JSON.stringify({ slug: "sede-2" }) }
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "org-1" }),
      });
      expect(res.status).toBe(409);
      expect(mockTx.organization.update).not.toHaveBeenCalled();
    });

    it("deve retornar 409 quando Prisma lançar P2002 no PATCH", async () => {
      setupValidGlobalAdmin();
      mockTx.organization.findUnique.mockResolvedValue({
        id: "org-1",
        slug: "sede-1",
        active: true,
      });
      mockTx.organization.findFirst.mockResolvedValue(null);
      mockTx.organization.update.mockRejectedValue({ code: "P2002" });

      const req = new NextRequest(
        "http://localhost:3000/api/admin/organizations/org-1",
        { method: "PATCH", body: JSON.stringify({ slug: "sede-2" }) }
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "org-1" }),
      });
      expect(res.status).toBe(409);
    });

    it("deve permitir desativar uma congregação quando houver outra ativa", async () => {
      setupValidGlobalAdmin();
      mockTx.organization.findUnique.mockResolvedValue({
        id: "org-2",
        slug: "betel",
        active: true,
      });
      mockTx.organization.count.mockResolvedValue(1);
      mockTx.organization.update.mockResolvedValue(
        makeOrgRecord({ id: "org-2", name: "Betel", slug: "betel", active: false })
      );

      const req = new NextRequest(
        "http://localhost:3000/api/admin/organizations/org-2",
        { method: "PATCH", body: JSON.stringify({ active: false }) }
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "org-2" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.active).toBe(false);
    });

    it("deve permitir ativar uma congregação inativa", async () => {
      setupValidGlobalAdmin();
      mockTx.organization.findUnique.mockResolvedValue({
        id: "org-2",
        slug: "betel",
        active: false,
      });
      mockTx.organization.update.mockResolvedValue(
        makeOrgRecord({ id: "org-2", name: "Betel", slug: "betel", active: true })
      );

      const req = new NextRequest(
        "http://localhost:3000/api/admin/organizations/org-2",
        { method: "PATCH", body: JSON.stringify({ active: true }) }
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "org-2" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.active).toBe(true);
    });

    it("deve BLOQUEAR (409) a desativação da última congregação ativa do sistema", async () => {
      setupValidGlobalAdmin();
      mockTx.organization.findUnique.mockResolvedValue({
        id: "org-1",
        slug: "sede-principal",
        active: true,
      });
      mockTx.organization.count.mockResolvedValue(0);

      const req = new NextRequest(
        "http://localhost:3000/api/admin/organizations/org-1",
        { method: "PATCH", body: JSON.stringify({ active: false }) }
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "org-1" }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain("última congregação ativa");
      expect(mockTx.organization.update).not.toHaveBeenCalled();
    });
  });

  describe("6. DELETE /api/admin/organizations/[id]", () => {
    it("deve retornar 401 para anônimo e 403 para não-Global Admin", async () => {
      mockAuth.mockResolvedValue(null);
      expect((await DELETE()).status).toBe(401);

      mockAuth.mockResolvedValue(
        createGlobalAdminSession({ isGlobalAdmin: false })
      );
      expect((await DELETE()).status).toBe(403);
    });

    it("deve retornar 405 para Global Admin e jamais chamar prisma.organization.delete", async () => {
      mockAuth.mockResolvedValue(createGlobalAdminSession());
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "usr-global-1",
        active: true,
        isGlobalAdmin: true,
      });

      const res = await DELETE();
      expect(res.status).toBe(405);
      const body = await res.json();
      expect(body.error).toContain("Exclusão definitiva");
      expect(mockPrisma.organization.delete).not.toHaveBeenCalled();
      expect(mockPrisma.organization.deleteMany).not.toHaveBeenCalled();
    });
  });
});
