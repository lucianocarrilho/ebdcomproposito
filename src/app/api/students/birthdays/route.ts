import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const orgData = await requireOrganization(true);
    if (!orgData || (orgData as any).error) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
    const { activeOrganizationId, orgRole } = orgData as any;

    const allowedRoles = ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE", "PROFESSOR", "APOIO"];
    if (!allowedRoles.includes(orgRole)) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const monthStr = searchParams.get("month");

    if (!monthStr) {
      return NextResponse.json({ error: "Mês não fornecido" }, { status: 400 });
    }

    const month = parseInt(monthStr);

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

    // Filter by month in JS because Prisma doesn't support month() function out of the box for SQLite/MySQL easily
    const birthdays = students.filter(student => {
      if (!student.birthDate) return false;
      return student.birthDate.getMonth() + 1 === month;
    });

    // Sort by day
    birthdays.sort((a, b) => {
      return (a.birthDate?.getDate() || 0) - (b.birthDate?.getDate() || 0);
    });

    return NextResponse.json(birthdays);
  } catch (error) {
    console.error("Erro ao buscar aniversariantes:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
