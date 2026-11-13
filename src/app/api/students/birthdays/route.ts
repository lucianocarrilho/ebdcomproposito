import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
    const yearStr = searchParams.get("year");

    const today = new Date();
    const month = monthStr ? parseInt(monthStr, 10) : today.getMonth() + 1;

    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Mês inválido" }, { status: 400 });
    }

    const year = yearStr && !isNaN(parseInt(yearStr, 10)) ? parseInt(yearStr, 10) : today.getFullYear();

    // Fetch all active students in this organization with birthDate
    const students = await prisma.student.findMany({
      where: {
        organizationId: activeOrganizationId,
        active: true,
        birthDate: { not: null },
      },
      select: {
        id: true,
        name: true,
        birthDate: true,
        class: { select: { id: true, name: true } },
        photo: true,
        organizationId: true,
      },
    });

    // Filter by birth month in JS across any year
    const birthdays = students
      .filter((student) => {
        if (!student.birthDate) return false;
        const b = new Date(student.birthDate);
        return b.getUTCMonth() + 1 === month;
      })
      .map((student) => {
        const birth = new Date(student.birthDate!);
        const birthYear = birth.getUTCFullYear();
        const birthMonth = birth.getUTCMonth() + 1;
        const birthDay = birth.getUTCDate();

        let age = year - birthYear;
        const currentYear = today.getFullYear();
        if (year === currentYear) {
          const currentMonthActual = today.getMonth() + 1;
          const currentDayActual = today.getDate();
          if (
            currentMonthActual < birthMonth ||
            (currentMonthActual === birthMonth && currentDayActual < birthDay)
          ) {
            age--;
          }
        }

        return {
          id: student.id,
          name: student.name,
          nome: student.name,
          birthDate: student.birthDate,
          nascimento: `${String(birthDay).padStart(2, "0")}/${String(birthMonth).padStart(2, "0")}`,
          class: student.class,
          classe: student.class?.name || "Sem Turma",
          idade: age >= 0 ? age : 0,
          photo: student.photo || undefined,
          dia: birthDay,
          organizationId: student.organizationId,
        };
      })
      .sort((a, b) => a.dia - b.dia);

    return NextResponse.json(birthdays);
  } catch (error) {
    console.error("Erro ao buscar aniversariantes:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
