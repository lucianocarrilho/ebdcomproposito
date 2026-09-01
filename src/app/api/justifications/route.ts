import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { requireOrganization } from "@/lib/organization-guard";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult.authorized) {
      return authResult.response;
    }
    const session = authResult.session;

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");

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
        if (studentId) whereClause.studentId = studentId;

        if (classId) {
          whereClause.student = { classId };
        }

        const justifications = await prisma.absenceJustification.findMany({
          where: whereClause,
          include: {
            student: {
              select: {
                id: true,
                name: true,
                classId: true,
              },
            },
            registeredBy: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { date: "desc" },
        });

        return NextResponse.json(justifications);
      }

      // Cargos Operacionais (PROFESSOR, APOIO)
      if (orgRole === "PROFESSOR" || orgRole === "APOIO") {
        if (!membership) {
          return NextResponse.json(
            { error: "Acesso negado: Membership não encontrada" },
            { status: 403 }
          );
        }

        // Buscar turmas ativas atribuídas ao usuário via CSA
        const assignments = await prisma.classStaffAssignment.findMany({
          where: {
            organizationMembershipId: membership.id,
            organizationId: targetOrgId,
            active: true,
          },
          select: { classId: true },
        });

        const assignedClassIds = assignments.map((a) => a.classId);

        // Se não possui turmas atribuídas por CSA, retorna lista vazia
        if (assignedClassIds.length === 0) {
          return NextResponse.json([]);
        }

        // Se o cliente solicitou uma turma específica, validar se está atribuída via CSA
        if (classId && !assignedClassIds.includes(classId)) {
          return NextResponse.json(
            { error: "Acesso negado: Turma não atribuída ao usuário nesta organização" },
            { status: 403 }
          );
        }

        const allowedClassIds = classId ? [classId] : assignedClassIds;

        const whereClause: any = {
          organizationId: targetOrgId,
          student: {
            classId: { in: allowedClassIds },
          },
        };

        if (studentId) whereClause.studentId = studentId;

        const justifications = await prisma.absenceJustification.findMany({
          where: whereClause,
          include: {
            student: {
              select: {
                id: true,
                name: true,
                classId: true,
              },
            },
            registeredBy: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { date: "desc" },
        });

        return NextResponse.json(justifications);
      }

      // Cargo desconhecido ou sem permissão
      return NextResponse.json(
        { error: "Acesso negado: Cargo sem permissão para visualizar justificativas" },
        { status: 403 }
      );
    }

    // Comportamento Legacy (Sem organização ativa e sem header x-organization-id)
    const whereClause: any = {};
    if (studentId) whereClause.studentId = studentId;

    if (classId) {
      whereClause.student = { classId };
    }

    const justifications = await prisma.absenceJustification.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            classId: true,
          },
        },
        registeredBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(justifications);
  } catch (error) {
    console.error("Erro ao buscar justificativas:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao buscar justificativas" },
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

    if ("organizationId" in body || "registeredById" in body) {
      return NextResponse.json(
        { error: "Campos controlados pelo servidor não podem ser enviados pelo cliente" },
        { status: 400 }
      );
    }

    const { studentId, date, reason, observations } = body;

    if (!studentId || !date || !reason) {
      return NextResponse.json(
        { error: "studentId, date e reason são obrigatórios" },
        { status: 400 }
      );
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Data inválida" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        organizationId: organizationId!,
        active: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Estudante não encontrado nesta organização" },
        { status: 404 }
      );
    }

    if (orgRole === "PROFESSOR" || orgRole === "APOIO") {
      if (!membership) {
        return NextResponse.json(
          { error: "Acesso negado: Membership não encontrada" },
          { status: 403 }
        );
      }

      const csa = await prisma.classStaffAssignment.findFirst({
        where: {
          organizationMembershipId: membership.id,
          classId: student.classId,
          organizationId: organizationId!,
          active: true,
        },
      });

      if (!csa) {
        return NextResponse.json(
          { error: "Acesso negado: Estudante não pertence a uma turma atribuída a este usuário" },
          { status: 403 }
        );
      }
    } else if (orgRole !== "ADMIN" && orgRole !== "DIRIGENTE" && orgRole !== "VICE_DIRIGENTE") {
      return NextResponse.json(
        { error: "Acesso negado: Cargo sem permissão para registrar justificativa" },
        { status: 403 }
      );
    }

    const justification = await prisma.$transaction(async (tx) => {
      const existingJustification = await tx.absenceJustification.findFirst({
        where: {
          studentId,
          date: parsedDate,
          organizationId: organizationId!,
        },
      });

      if (existingJustification) {
        return await tx.absenceJustification.update({
          where: { id: existingJustification.id },
          data: {
            reason,
            observations,
            registeredById: session.user.id,
          },
        });
      }

      return await tx.absenceJustification.create({
        data: {
          studentId,
          date: parsedDate,
          reason,
          observations,
          organizationId: organizationId!,
          registeredById: session.user.id,
        },
      });
    });

    return NextResponse.json(justification, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar justificativa:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao registrar justificativa" },
      { status: 500 }
    );
  }
}
