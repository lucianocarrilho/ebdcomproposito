import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json({ error: "ID da organização não fornecido" }, { status: 400 });
    }

    const user = session.user as any;

    // Verify organization exists and is active
    const org = await prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!org || !org.active) {
      return NextResponse.json({ error: "Organização inexistente ou inativa" }, { status: 403 });
    }

    // Check user permissions
    if (!user.isGlobalAdmin) {
      const membership = await prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: organizationId
          }
        }
      });

      if (!membership || membership.status !== "ACTIVE") {
        return NextResponse.json({ error: "Você não possui acesso ativo a esta organização" }, { status: 403 });
      }
    }

    // Validation successful! The client can now call update({ activeOrganizationId: organizationId })
    // and the JWT callback will perform the same validation before actually modifying the token.
    return NextResponse.json({ success: true, message: "Validação concluída" });

  } catch (error) {
    console.error("Erro ao validar troca de organização:", error);
    return NextResponse.json({ error: "Erro interno ao processar validação" }, { status: 500 });
  }
}
