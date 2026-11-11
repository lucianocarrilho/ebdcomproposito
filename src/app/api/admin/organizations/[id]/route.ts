import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/permissions";
import {
  ORGANIZATION_ADMIN_SELECT,
  hasPrismaErrorCode,
  parseUpdateOrganizationInput,
} from "@/lib/organization-validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireGlobalAdmin(true);
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { id } = await params;
    if (!id || !id.trim()) {
      return NextResponse.json(
        { error: "ID da congregação inválido." },
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

    const parsed = parseUpdateOrganizationInput(rawBody);
    if (!parsed.valid) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const txResult = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.organization.findUnique({
          where: { id },
          select: { id: true, slug: true, active: true },
        });

        if (!existing) {
          return {
            error: "Congregação não encontrada.",
            status: 404 as const,
          };
        }

        if (parsed.data.active === false && existing.active) {
          const otherActiveCount = await tx.organization.count({
            where: {
              active: true,
              id: { not: id },
            },
          });

          if (otherActiveCount === 0) {
            return {
              error:
                "Não é possível desativar a última congregação ativa do sistema.",
              status: 409 as const,
            };
          }
        }

        if (
          parsed.data.slug !== undefined &&
          parsed.data.slug !== existing.slug
        ) {
          const slugConflict = await tx.organization.findFirst({
            where: {
              slug: parsed.data.slug,
              id: { not: id },
            },
            select: { id: true },
          });

          if (slugConflict) {
            return {
              error: "Já existe uma congregação cadastrada com este slug.",
              status: 409 as const,
            };
          }
        }

        const updateData: { name?: string; slug?: string; active?: boolean } =
          {};
        if (parsed.data.name !== undefined) {
          updateData.name = parsed.data.name;
        }
        if (parsed.data.slug !== undefined) {
          updateData.slug = parsed.data.slug;
        }
        if (parsed.data.active !== undefined) {
          updateData.active = parsed.data.active;
        }

        const updated = await tx.organization.update({
          where: { id },
          data: updateData,
          select: ORGANIZATION_ADMIN_SELECT,
        });

        return {
          organization: updated,
          status: 200 as const,
        };
      },
      { isolationLevel: "Serializable" }
    );

    if ("error" in txResult) {
      return NextResponse.json(
        { error: txResult.error },
        { status: txResult.status }
      );
    }

    return NextResponse.json(txResult.organization, { status: 200 });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { error: "Já existe uma congregação cadastrada com este slug." },
        { status: 409 }
      );
    }
    if (hasPrismaErrorCode(error, "P2025")) {
      return NextResponse.json(
        { error: "Congregação não encontrada." },
        { status: 404 }
      );
    }
    if (hasPrismaErrorCode(error, "P2034")) {
      return NextResponse.json(
        { error: "Conflito ao atualizar congregação. Tente novamente." },
        { status: 409 }
      );
    }
    console.error("[API Admin Organizations PATCH] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno ao atualizar congregação." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const authResult = await requireGlobalAdmin(true);
  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  return NextResponse.json(
    {
      error:
        "Exclusão definitiva de congregações não é permitida. Utilize a desativação.",
    },
    { status: 405 }
  );
}
