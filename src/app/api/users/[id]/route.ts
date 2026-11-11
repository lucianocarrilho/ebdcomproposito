import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";
import { hasPrismaErrorCode } from "@/lib/organization-validation";
import {
  normalizeAccessEmail,
  parseUpdateUserAccessInput,
  type UpdateUserAccessInput,
} from "@/lib/user-access-validation";

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

class MembershipOperationError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function ensureNotLastActiveAdmin(
  tx: Prisma.TransactionClient,
  activeOrganizationId: string,
  errorMessage: string
): Promise<void> {
  const activeAdminCount = await tx.organizationMembership.count({
    where: {
      organizationId: activeOrganizationId,
      status: "ACTIVE",
      role: "ADMIN",
      user: {
        active: true,
      },
    },
  });

  if (activeAdminCount <= 1) {
    throw new MembershipOperationError(errorMessage, 409);
  }
}

function formatDateKey(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function hasGlobalProfileChanges(
  input: UpdateUserAccessInput,
  currentUser: {
    name: string;
    email: string;
    image: string | null;
    birthDate: Date | null;
  }
): boolean {
  if (input.password !== undefined) {
    return true;
  }

  if (input.name !== undefined && input.name !== currentUser.name) {
    return true;
  }

  if (
    input.email !== undefined &&
    input.email !== normalizeAccessEmail(currentUser.email)
  ) {
    return true;
  }

  if (
    input.image !== undefined &&
    (input.image ?? null) !== (currentUser.image ?? null)
  ) {
    return true;
  }

  if (
    input.birthDate !== undefined &&
    formatDateKey(input.birthDate) !== formatDateKey(currentUser.birthDate)
  ) {
    return true;
  }

  return false;
}

function serializeMembershipResponse(membership: {
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
}) {
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
  };
}

async function handleUpdateMembershipAccess(
  request: NextRequest,
  params: Promise<{ id: string }>
) {
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

    const { id } = await params;
    if (!id || !id.trim()) {
      return NextResponse.json(
        { error: "ID do vínculo inválido." },
        { status: 400 }
      );
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

    const parsed = parseUpdateUserAccessInput(rawBody);
    if (!parsed.valid) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const input = parsed.data;
    const activeOrganizationId = authResult.activeOrganizationId as string;

    const updatedMembership = await prisma.$transaction(
      async (tx) => {
        const targetMembership = await tx.organizationMembership.findFirst({
          where: {
            organizationId: activeOrganizationId,
            status: "ACTIVE",
            OR: [{ id }, { userId: id }],
          },
          select: MEMBERSHIP_ACCESS_SELECT,
        });

        if (!targetMembership || !targetMembership.user.active) {
          throw new MembershipOperationError(
            "Vínculo não encontrado nesta congregação.",
            404
          );
        }

        const isSharedUser =
          targetMembership.user.isGlobalAdmin ||
          targetMembership.user._count.memberships > 1;

        if (isSharedUser && hasGlobalProfileChanges(input, targetMembership.user)) {
          throw new MembershipOperationError(
            "Usuário compartilhado entre múltiplas congregações ou Admin Global: apenas o perfil na congregação atual pode ser alterado.",
            403
          );
        }

        if (
          targetMembership.role === "ADMIN" &&
          input.role !== undefined &&
          input.role !== "ADMIN"
        ) {
          await ensureNotLastActiveAdmin(
            tx,
            activeOrganizationId,
            "Não é possível rebaixar o último administrador ativo desta congregação."
          );
        }

        if (!isSharedUser) {
          const userUpdateData: {
            name?: string;
            email?: string;
            password?: string;
            role?: typeof input.role;
            image?: string | null;
            birthDate?: Date | null;
          } = {};

          if (input.name !== undefined) userUpdateData.name = input.name;
          if (input.email !== undefined) userUpdateData.email = input.email;
          if (input.role !== undefined) userUpdateData.role = input.role;
          if (input.image !== undefined) userUpdateData.image = input.image;
          if (input.birthDate !== undefined) {
            userUpdateData.birthDate = input.birthDate;
          }
          if (input.password !== undefined) {
            userUpdateData.password = await bcrypt.hash(input.password, 10);
          }

          if (Object.keys(userUpdateData).length > 0) {
            await tx.user.update({
              where: { id: targetMembership.userId },
              data: userUpdateData,
              select: { id: true },
            });
          }
        }

        return tx.organizationMembership.update({
          where: {
            id_organizationId: {
              id: targetMembership.id,
              organizationId: activeOrganizationId,
            },
          },
          data: {
            ...(input.role !== undefined ? { role: input.role } : {}),
          },
          select: MEMBERSHIP_ACCESS_SELECT,
        });
      },
      { isolationLevel: "Serializable" }
    );

    return NextResponse.json(serializeMembershipResponse(updatedMembership));
  } catch (error) {
    if (error instanceof MembershipOperationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (hasPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { error: "Já existe um usuário cadastrado com este e-mail." },
        { status: 409 }
      );
    }

    if (hasPrismaErrorCode(error, "P2034")) {
      return NextResponse.json(
        { error: "Conflito de concorrência ao atualizar vínculo. Tente novamente." },
        { status: 409 }
      );
    }

    console.error("[API Users PUT] Erro ao atualizar vínculo:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar vínculo" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdateMembershipAccess(request, params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdateMembershipAccess(request, params);
}

// DELETE - Remover/Inativar SOMENTE o vínculo da congregação atual (nunca exclui o User global)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    if (!id || !id.trim()) {
      return NextResponse.json(
        { error: "ID do vínculo inválido." },
        { status: 400 }
      );
    }

    const activeOrganizationId = authResult.activeOrganizationId as string;

    const removed = await prisma.$transaction(
      async (tx) => {
        const targetMembership = await tx.organizationMembership.findFirst({
          where: {
            organizationId: activeOrganizationId,
            status: "ACTIVE",
            OR: [{ id }, { userId: id }],
          },
          select: {
            id: true,
            userId: true,
            organizationId: true,
            role: true,
          },
        });

        if (!targetMembership) {
          throw new MembershipOperationError(
            "Vínculo não encontrado nesta congregação.",
            404
          );
        }

        if (targetMembership.role === "ADMIN") {
          await ensureNotLastActiveAdmin(
            tx,
            activeOrganizationId,
            "Não é possível remover o último administrador ativo desta congregação."
          );
        }

        if (
          !authResult.isGlobalAdmin &&
          targetMembership.userId === authResult.user.id
        ) {
          throw new MembershipOperationError(
            "Você não pode remover seu próprio acesso nesta congregação.",
            400
          );
        }

        await tx.classStaffAssignment.updateMany({
          where: {
            organizationId: activeOrganizationId,
            organizationMembershipId: targetMembership.id,
            active: true,
          },
          data: { active: false },
        });

        await tx.organizationMembership.update({
          where: {
            id_organizationId: {
              id: targetMembership.id,
              organizationId: activeOrganizationId,
            },
          },
          data: { status: "INACTIVE" },
        });

        return targetMembership;
      },
      { isolationLevel: "Serializable" }
    );

    return NextResponse.json({
      success: true,
      removedMembershipId: removed.id,
      userId: removed.userId,
      organizationId: removed.organizationId,
    });
  } catch (error) {
    if (error instanceof MembershipOperationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (hasPrismaErrorCode(error, "P2034")) {
      return NextResponse.json(
        { error: "Conflito de concorrência ao remover vínculo. Tente novamente." },
        { status: 409 }
      );
    }

    console.error("[API Users DELETE] Erro ao remover vínculo:", error);
    return NextResponse.json(
      { error: "Erro ao remover vínculo" },
      { status: 500 }
    );
  }
}
