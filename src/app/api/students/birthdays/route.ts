import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireOrganization(true);
    if ("error" in authResult || !("activeOrganizationId" in authResult)) {
      return NextResponse.json(
        {
          error:
            "error" in authResult
              ? authResult.error
              : "Organização não selecionada",
        },
        {
          status:
            "status" in authResult
              ? authResult.status
              : 403,
        }
      );
    }
    const { activeOrganizationId, orgRole, globalAdminMode } = authResult;

    const allowedRoles = ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE", "PROFESSOR", "APOIO"];
    const isAllowed =
      globalAdminMode ||
      (orgRole ? allowedRoles.includes(orgRole) : false);

    if (!isAllowed) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const monthStr = searchParams.get("month");

    if (!monthStr) {
      return NextResponse.json({ error: "Mês não fornecido" }, { status: 400 });
    }

    const month = parseInt(monthStr);
    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Mês inválido" }, { status: 400 });
    }

    // Fetch all active students in this organization
    const students = await prisma.student.findMany({
      where: {
        organizationId: activeOrganizationId,
        active: true,
        birthDate: { not: null }
      },
      select: {
        id: true,
        name: true,
        birthDate: true,
        class: { select: { id: true, name: true } },
        photo: true
      }
    });

    const birthdays = students.filter(student => {
      if (!student.birthDate) return false;
      return student.birthDate.getUTCMonth() + 1 === month;
    });

    birthdays.sort((a, b) => {
      return (a.birthDate?.getUTCDate() || 0) - (b.birthDate?.getUTCDate() || 0);
    });

    return NextResponse.json(birthdays);
  } catch (error) {
    console.error("Erro ao buscar aniversariantes:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
