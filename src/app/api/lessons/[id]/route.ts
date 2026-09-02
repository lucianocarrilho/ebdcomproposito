import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await requireOrganization(true);
    if ("error" in authResult || !("activeOrganizationId" in authResult)) {
      return NextResponse.json(
        { error: "error" in authResult ? authResult.error : "Organização não selecionada" },
        { status: "status" in authResult ? authResult.status : 403 }
      );
    }

    const { activeOrganizationId, orgRole, membership, user, globalAdminMode } = authResult;

    const existingLesson = await prisma.lesson.findFirst({
      where: {
        id,
        organizationId: activeOrganizationId,
      },
    });

    if (!existingLesson) {
      return NextResponse.json(
        { error: "Lição não encontrada nesta organização" },
        { status: 404 }
      );
    }

    const body = await req.json();

    if ("organizationId" in body) {
      return NextResponse.json(
        { error: "Campos controlados pelo servidor não podem ser enviados pelo cliente" },
        { status: 400 }
      );
    }

    const { category } = body;
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

      const targetCategory = category || existingLesson.category;

      if (!allowedCategories.includes(targetCategory)) {
        return NextResponse.json(
          { error: "Acesso negado: Categoria não atribuída ao usuário nesta organização via CSA" },
          { status: 403 }
        );
      }
    } else if (!isManager) {
      return NextResponse.json(
        { error: "Acesso negado: Cargo sem permissão para editar lição" },
        { status: 403 }
      );
    }

    const updatedLesson = await prisma.lesson.update({
      where: { id },
      data: {
        number: body.number !== undefined ? Number(body.number) : undefined,
        title: body.title !== undefined ? body.title : undefined,
        quarter: body.quarter !== undefined ? body.quarter : undefined,
        category: body.category !== undefined ? body.category : undefined,
        date: body.date !== undefined ? (body.date ? new Date(body.date) : null) : undefined,
        summary: body.summary !== undefined ? body.summary : undefined,
        bibleText: body.bibleText !== undefined ? body.bibleText : undefined,
        teacherName: body.teacherName !== undefined ? body.teacherName : undefined,
        image: body.image !== undefined ? body.image : undefined,
        status: body.status !== undefined ? body.status : undefined,
        classId: body.classId !== undefined ? body.classId : undefined,
      },
    });

    return NextResponse.json(updatedLesson);
  } catch (error) {
    console.error("Erro ao atualizar lição:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao atualizar lição" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await requireOrganization(true);
    if ("error" in authResult || !("activeOrganizationId" in authResult)) {
      return NextResponse.json(
        { error: "error" in authResult ? authResult.error : "Organização não selecionada" },
        { status: "status" in authResult ? authResult.status : 403 }
      );
    }

    const { activeOrganizationId, orgRole, membership, user, globalAdminMode } = authResult;

    const isManager = globalAdminMode || (orgRole ? ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE"].includes(orgRole) : false);

    if (!isManager) {
      return NextResponse.json(
        { error: "Acesso negado: Cargo sem permissão para excluir lição" },
        { status: 403 }
      );
    }

    const existingLesson = await prisma.lesson.findFirst({
      where: {
        id,
        organizationId: activeOrganizationId,
      },
    });

    if (!existingLesson) {
      return NextResponse.json(
        { error: "Lição não encontrada nesta organização" },
        { status: 404 }
      );
    }

    await prisma.lesson.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Lição excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir lição:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao excluir lição" },
      { status: 500 }
    );
  }
}
