import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';
import { requireOrganization } from '@/lib/organization-guard';

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult.authorized) {
      return authResult.response;
    }
    const session = authResult.session;

    const { searchParams } = new URL(req.url);
    const quarter = searchParams.get('quarter');
    const category = searchParams.get('category');
    const classId = searchParams.get('classId');

    // Lógica Multi-tenant isolada (S3A.2)
    const orgResult = await requireOrganization(req, {
      requireActiveOrg: false,
      allowGlobalAdminFallback: false,
    });

    if (!orgResult.authorized) {
      return orgResult.response;
    }

    const { organizationId, isGlobalAdmin, activeOrgId } = orgResult;

    // Se o usuário tiver um activeOrganizationId ou organização resolvida via guard
    if (organizationId || activeOrgId) {
      const targetOrgId = organizationId || activeOrgId;

      // Buscar membership ativa do usuário para determinar seu cargo real na organização
      const membership = await prisma.organizationMembership.findFirst({
        where: {
          userId: session.user.id,
          organizationId: targetOrgId,
          status: "ACTIVE",
        },
      });

      // Se não possui membership ativa e não é Global Admin, 403 Forbidden
      if (!membership && !isGlobalAdmin) {
        return NextResponse.json(
          { error: "Acesso negado: Usuário não é membro ativo desta organização" },
          { status: 403 }
        );
      }

      const orgRole = membership?.role || (isGlobalAdmin ? "ADMIN" : null);

      // Cargos Gestores (ADMIN, DIRIGENTE, VICE_DIRIGENTE) ou Global Admin
      if (orgRole === "ADMIN" || orgRole === "DIRIGENTE" || orgRole === "VICE_DIRIGENTE") {
        const whereClause: any = { organizationId: targetOrgId };
        if (quarter) whereClause.quarter = quarter;
        if (category) whereClause.category = category;
        if (classId) whereClause.classId = classId;

        const lessons = await prisma.lesson.findMany({
          where: whereClause,
          orderBy: { number: 'asc' },
        });

        return NextResponse.json(lessons);
      }

      // Cargos Operacionais (PROFESSOR, APOIO)
      if (orgRole === "PROFESSOR" || orgRole === "APOIO") {
        if (!membership) {
          return NextResponse.json(
            { error: "Acesso negado: Membership não encontrada" },
            { status: 403 }
          );
        }

        // Buscar turmas ativas atribuídas ao usuário via CSA com include da Class para categoria de lição
        const assignments = await prisma.classStaffAssignment.findMany({
          where: {
            organizationMembershipId: membership.id,
            organizationId: targetOrgId,
            active: true,
          },
          include: {
            class: true,
          },
        });

        // Extrair os nomes e audiências/categorias das turmas atribuídas
        const assignedClassNames = assignments.map((a) => a.class.name);
        const assignedAudiences = assignments
          .map((a) => a.class.audience)
          .filter((aud): aud is string => Boolean(aud));

        const allowedCategories = Array.from(
          new Set([...assignedClassNames, ...assignedAudiences])
        );

        // Se não possui turmas nem categorias válidas via CSA, retorna lista vazia
        if (allowedCategories.length === 0) {
          return NextResponse.json([]);
        }

        const whereClause: any = {
          organizationId: targetOrgId,
          category: { in: allowedCategories },
        };

        if (quarter) whereClause.quarter = quarter;
        if (category) {
          // Rejeitar se tentar filtrar por categoria não autorizada pelo CSA
          if (!allowedCategories.includes(category)) {
            return NextResponse.json(
              { error: "Acesso negado: Categoria não atribuída ao usuário nesta organização" },
              { status: 403 }
            );
          }
          whereClause.category = category;
        }

        if (classId) whereClause.classId = classId;

        const lessons = await prisma.lesson.findMany({
          where: whereClause,
          orderBy: { number: 'asc' },
        });

        return NextResponse.json(lessons);
      }

      // Cargo desconhecido ou sem permissão
      return NextResponse.json(
        { error: "Acesso negado: Cargo sem permissão para visualizar lições" },
        { status: 403 }
      );
    }

    // Comportamento Legacy (Sem organização ativa e sem header x-organization-id)
    const whereClause: any = {};
    if (quarter) whereClause.quarter = quarter;
    if (category) whereClause.category = category;
    if (classId) whereClause.classId = classId;

    const lessons = await prisma.lesson.findMany({
      where: whereClause,
      orderBy: { number: 'asc' },
    });

    return NextResponse.json(lessons);
  } catch (error) {
    console.error("Erro ao buscar lições:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao buscar lições" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult.authorized) {
      return authResult.response;
    }
    const session = authResult.session;

    const orgResult = await requireOrganization(req, {
      requireActiveOrg: true,
      allowGlobalAdminFallback: false,
    });

    if (!orgResult.authorized) {
      return orgResult.response;
    }

    const { organizationId, isGlobalAdmin } = orgResult;

    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: session.user.id,
        organizationId: organizationId!,
        status: "ACTIVE",
      },
    });

    if (!membership && !isGlobalAdmin) {
      return NextResponse.json(
        { error: "Acesso negado: Membro inativo ou não pertencente a esta organização" },
        { status: 403 }
      );
    }

    const orgRole = membership?.role || (isGlobalAdmin ? "ADMIN" : null);

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
          organizationId: organizationId!,
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
    } else if (orgRole !== "ADMIN" && orgRole !== "DIRIGENTE" && orgRole !== "VICE_DIRIGENTE") {
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
        organizationId: organizationId!,
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
