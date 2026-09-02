import { prisma } from "@/lib/prisma";
import { requireOrganization, getUserAssignedClasses } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Listar lições
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireOrganization(true);
    if ("error" in authResult || !("activeOrganizationId" in authResult)) {
      return NextResponse.json(
        { error: "error" in authResult ? authResult.error : "Organização não selecionada" },
        { status: "status" in authResult ? authResult.status : 403 }
      );
    }

    const { activeOrganizationId, orgRole, membership, user, globalAdminMode } = authResult;

    const fullAccessRoles = ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE"];
    const isManager = globalAdminMode || (orgRole ? fullAccessRoles.includes(orgRole) : false);
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

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireOrganization(true);
    if ("error" in authResult || !("activeOrganizationId" in authResult)) {
      return NextResponse.json(
        { error: "error" in authResult ? authResult.error : "Organização não selecionada" },
        { status: "status" in authResult ? authResult.status : 403 }
      );
    }

    const { activeOrganizationId, orgRole, membership, user, globalAdminMode } = authResult;

    const body = await req.json();

    if ("organizationId" in body) {
      return NextResponse.json(
        { error: "Campos controlados pelo servidor não podem ser enviados pelo cliente" },
        { status: 400 }
      );
    }

    const { number, title, quarter, category, date, summary, bibleText, teacherName, image, classId } = body;

    if (!number || !title || !quarter || !category) {
      return NextResponse.json(
        { error: "number, title, quarter e category são obrigatórios" },
        { status: 400 }
      );
    }

    const isManager = globalAdminMode || (orgRole ? ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE"].includes(orgRole) : false);

    if (orgRole === "PROFESSOR" || orgRole === "APOIO") {
      if (!membership) {
        return NextResponse.json(
          { error: "Acesso negado: Membership não encontrada" },
          { status: 403 }
        );
      }

      const assignments = await prisma.classStaffAssignment.findMany({
        where: {
          organizationMembershipId: membership.id,
          organizationId: activeOrganizationId,
          active: true,
        },
        include: {
          class: true,
        },
      });

      const assignedClassNames = assignments.map((a) => a.class.name);
      const assignedAudiences = assignments
        .map((a) => a.class.audience)
        .filter((aud): aud is string => Boolean(aud));

      const allowedCategories = Array.from(
        new Set([...assignedClassNames, ...assignedAudiences])
      );

      if (!allowedCategories.includes(category)) {
        return NextResponse.json(
          { error: "Acesso negado: Categoria não atribuída ao usuário nesta organização via CSA" },
          { status: 403 }
        );
      }
    } else if (!isManager) {
      return NextResponse.json(
        { error: "Acesso negado: Cargo sem permissão para criar lição" },
        { status: 403 }
      );
    }

    const lesson = await prisma.lesson.create({
      data: {
        number: Number(number),
        title,
        quarter,
        category,
        date: date ? new Date(date) : null,
        summary: summary || null,
        bibleText: bibleText || null,
        teacherName: teacherName || null,
        image: image || null,
        classId: classId || null,
        organizationId: activeOrganizationId,
      },
    });

    return NextResponse.json(lesson, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar lição:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao criar lição" },
      { status: 500 }
    );
  }
}
