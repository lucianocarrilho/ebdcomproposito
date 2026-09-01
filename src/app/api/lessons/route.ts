import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrganization, getUserAssignedClasses } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Listar lições
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireOrganization(true);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { activeOrganizationId, orgRole, membership, user, globalAdminMode } = authResult as any;

    const fullAccessRoles = ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE"];
    const isManager = globalAdminMode || fullAccessRoles.includes(orgRole);
    const isRestricted = orgRole === "PROFESSOR" || orgRole === "APOIO";

    if (!isManager && !isRestricted) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get("quarter") || "2026-Q2";
    const category = searchParams.get("category");

    const where: any = { quarter };

    if (isManager) {
      where.OR = [
        {
          organizationId: activeOrganizationId,
          OR: [
            { classId: null },
            { class: { organizationId: activeOrganizationId } }
          ]
        },
        {
          organizationId: null,
          classId: null
        }
      ];

      if (category) {
        where.category = category;
      }
    } else {
      if (!membership?.id) {
        return NextResponse.json([]);
      }

      const { classIds } = await getUserAssignedClasses(user.id, activeOrganizationId, membership.id);

      if (!classIds || classIds.length === 0) {
        return NextResponse.json([]);
      }

      const activeClasses = await prisma.class.findMany({
        where: {
          id: { in: classIds },
          organizationId: activeOrganizationId,
          status: true
        },
        select: { id: true, name: true }
      });

      if (activeClasses.length === 0) {
        return NextResponse.json([]);
      }

      const assignedClassIds = activeClasses.map(c => c.id);
      const allowedCategories = activeClasses.map(c => c.name);

      if (category && !allowedCategories.includes(category)) {
        return NextResponse.json([]);
      }

      const targetCategories = category ? [category] : allowedCategories;

      where.OR = [
        {
          organizationId: activeOrganizationId,
          classId: { in: assignedClassIds }
        },
        {
          organizationId: activeOrganizationId,
          classId: null,
          category: { in: targetCategories }
        },
        {
          organizationId: null,
          classId: null,
          category: { in: targetCategories }
        }
      ];
    }

    const lessons = await prisma.lesson.findMany({
      where,
      orderBy: { number: "asc" },
    });

    return NextResponse.json(lessons);
  } catch (error) {
    console.error("Erro ao buscar lições:", error);
    return NextResponse.json({ error: "Erro ao buscar lições" }, { status: 500 });
  }
}

// POST - Criar lição
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { number, title, quarter, category, date, summary, bibleText, status, image } = body;

    if (!title || !number) {
      return NextResponse.json({ error: "Título e número são obrigatórios" }, { status: 400 });
    }

    const lesson = await prisma.lesson.create({
      data: {
        number: Number(number),
        title,
        quarter: quarter || "2026-Q2",
        category: category || "Adultos",
        date: date ? new Date(date) : null,
        summary,
        bibleText,
        image,
        status: status || "pendente",
      },
    });

    return NextResponse.json(lesson, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao criar lição:", error);
    return NextResponse.json({ error: error.message || "Erro ao criar lição" }, { status: 500 });
  }
}
