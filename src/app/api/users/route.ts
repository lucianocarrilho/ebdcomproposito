import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";
import { hasPrismaErrorCode } from "@/lib/organization-validation";
import { parseCreateUserAccessInput } from "@/lib/user-access-validation";

const MEMBERSHIP_ACCESS_SELECT = {
  id: true,
  userId: true,
  organizationId: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      birthDate: true,
      isGlobalAdmin: true,
      active: true,
      _count: {
        select: {
          memberships: true,
        },
      },
    },
  },
} as const;

class AccessConflictError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function serializeAccessMembership(
  membership: {
    id: string;
    userId: string;
    organizationId: string;
    role: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
      image: string | null;
      birthDate: Date | null;
      isGlobalAdmin: boolean;
      _count: { memberships: number };
    };
  },
  extra?: { linkedExistingUser?: boolean }
) {
  return {
    id: membership.user.id,
    userId: membership.user.id,
    membershipId: membership.id,
    organizationId: membership.organizationId,
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role,
    status: membership.status,
    image: membership.user.image,
    birthDate: membership.user.birthDate,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
    isGlobalAdmin: membership.user.isGlobalAdmin,
    isSharedUser:
      membership.user.isGlobalAdmin || membership.user._count.memberships > 1,
    ...(extra?.linkedExistingUser !== undefined
      ? { linkedExistingUser: extra.linkedExistingUser }
      : {}),
  };
}

// GET - Listar apenas vínculos (OrganizationMembership) ativos da congregação atual
export async function GET() {
  try {
    const authResult = await requireOrganization(true);
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    if (!("activeOrganizationId" in authResult) || !authResult.activeOrganizationId) {
      return NextResponse.json(
        { error: "Organização não selecionada" },
        { status: 403 }
      );
    }

    if (authResult.orgRole !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const memberships = await prisma.organizationMembership.findMany({
      where: {
        organizationId: authResult.activeOrganizationId,
        status: "ACTIVE",
        user: {
          active: true,
        },
      },
      orderBy: { createdAt: "desc" },
      select: MEMBERSHIP_ACCESS_SELECT,
    });

    return NextResponse.json(
      memberships.map((membership) => serializeAccessMembership(membership))
    );
  } catch (error) {
    console.error("[API Users GET] Erro ao buscar acessos:", error);
    return NextResponse.json(
      { error: "Erro ao buscar acessos" },
      { status: 500 }
    );
  }
}

// POST - Criar usuário + vínculo ativo na congregação atual, ou vincular/reativar usuário existente
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireOrganization(true);
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    if (!("activeOrganizationId" in authResult) || !authResult.activeOrganizationId) {
      return NextResponse.json(
        { error: "Organização não selecionada" },
        { status: 403 }
      );
    }

    if (authResult.orgRole !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Payload JSON inválido." },
        { status: 400 }
      );
    }

    const parsed = parseCreateUserAccessInput(rawBody);
    if (!parsed.valid) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const input = parsed.data;
    const activeOrganizationId = authResult.activeOrganizationId as string;

    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: input.email },
        select: {
          id: true,
          active: true,
        },
      });

      if (existingUser) {
        if (!existingUser.active) {
          throw new AccessConflictError(
            "Este usuário está inativo globalmente no sistema.",
            409
          );
        }

        const existingMembership = await tx.organizationMembership.findUnique({
          where: {
            userId_organizationId: {
              userId: existingUser.id,
              organizationId: activeOrganizationId,
            },
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (existingMembership?.status === "ACTIVE") {
          throw new AccessConflictError(
            "Este usuário já possui vínculo ativo nesta congregação.",
            409
          );
        }

        const membership = existingMembership
          ? await tx.organizationMembership.update({
              where: {
                id_organizationId: {
                  id: existingMembership.id,
                  organizationId: activeOrganizationId,
                },
              },
              data: {
                status: "ACTIVE",
                role: input.role,
              },
              select: MEMBERSHIP_ACCESS_SELECT,
            })
          : await tx.organizationMembership.create({
              data: {
                userId: existingUser.id,
                organizationId: activeOrganizationId,
                role: input.role,
                status: "ACTIVE",
              },
              select: MEMBERSHIP_ACCESS_SELECT,
            });

        return { membership, linkedExistingUser: true };
      }

      if (!input.name) {
        throw new AccessConflictError(
          "Nome é obrigatório para novo usuário.",
          400
        );
      }

      if (!input.password) {
        throw new AccessConflictError(
          "Senha é obrigatória para novo usuário.",
          400
        );
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);

      const createdUser = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          password: hashedPassword,
          role: input.role,
          image: input.image ?? null,
          birthDate: input.birthDate ?? null,
          active: true,
          isGlobalAdmin: false,
        },
        select: { id: true },
      });

      const membership = await tx.organizationMembership.create({
        data: {
          userId: createdUser.id,
          organizationId: activeOrganizationId,
          role: input.role,
          status: "ACTIVE",
        },
        select: MEMBERSHIP_ACCESS_SELECT,
      });

      return { membership, linkedExistingUser: false };
    });

    return NextResponse.json(
      serializeAccessMembership(result.membership, {
        linkedExistingUser: result.linkedExistingUser,
      }),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AccessConflictError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (hasPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { error: "Este usuário já possui cadastro ou vínculo conflitante." },
        { status: 409 }
      );
    }

    console.error("[API Users POST] Erro ao criar acesso:", error);
    return NextResponse.json(
      { error: "Erro ao criar acesso" },
      { status: 500 }
    );
  }
}
