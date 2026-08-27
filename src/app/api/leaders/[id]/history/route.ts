import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgData = await requireOrganization(true);
    if (!orgData || (orgData as any).error) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
    const { activeOrganizationId, orgRole } = orgData as any;

    const allowedRoles = ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE", "APOIO"]; // Professor removido de history se desejar restrito, mas na matriz estava APOIO
    if (!allowedRoles.includes(orgRole)) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const leader = await prisma.leader.findUnique({
      where: { id: id }
    });

    if (!leader || leader.organizationId !== activeOrganizationId) {
      return NextResponse.json({ error: "Líder não encontrado" }, { status: 404 });
    }

    const attendance = await prisma.leaderAttendance.findMany({
      where: { leaderId: id },
      orderBy: { date: "desc" },
      take: 20
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("Erro ao buscar histórico do líder:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
