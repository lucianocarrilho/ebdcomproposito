import { prisma } from "@/lib/prisma";
import { requireOrganization, getUserAssignedClasses } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

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

    let assignedClassIds: string[] = [];

    if (isRestricted) {
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
        select: { id: true }
      });

      assignedClassIds = activeClasses.map(c => c.id);

      if (assignedClassIds.length === 0) {
        return NextResponse.json([]);
      }
    }

    const justificationWhere: any = {
      AND: [
        {
          student: {
            organizationId: activeOrganizationId,
            class: {
              organizationId: activeOrganizationId,
              status: true
            }
          }
        },
        {
          OR: [
            { organizationId: activeOrganizationId },
            { organizationId: null }
          ]
        }
      ]
    };

    if (isRestricted) {
      justificationWhere.AND.push({
        student: {
          classId: { in: assignedClassIds }
        }
      });
    }

    const justifications = await prisma.absenceJustification.findMany({
      where: justificationWhere,
      include: {
        student: { select: { name: true, photo: true, class: { select: { name: true } } } },
        registeredBy: { select: { name: true } }
      },
      orderBy: { date: "desc" }
    });

    const formatted = justifications.map(j => ({
      id: j.id,
      studentName: j.student.name,
      studentPhoto: j.student.photo || null,
      className: j.student.class.name,
      date: j.date.toLocaleDateString("pt-BR"),
      dateRaw: j.date,
      reason: j.reason,
      observations: j.observations || "",
      registeredBy: j.registeredBy?.name || "Sistema",
      isLeader: false
    }));

    let formattedLeaders: any[] = [];

    if (isManager) {
      const leaderJustifications = await prisma.leaderAttendance.findMany({
        where: {
          status: "FALTA_JUSTIFICADA",
          leader: {
            organizationId: activeOrganizationId,
            active: true,
            OR: [
              { classId: null },
              { class: { organizationId: activeOrganizationId } }
            ]
          }
        },
        include: {
          leader: { select: { name: true, role: true, photo: true } }
        },
        orderBy: { date: "desc" }
      });

      formattedLeaders = leaderJustifications.map(lj => ({
        id: lj.id,
        studentName: lj.leader.name,
        studentPhoto: lj.leader.photo || null,
        className: `Liderança (${lj.leader.role})`,
        date: lj.date.toLocaleDateString("pt-BR"),
        dateRaw: lj.date,
        reason: lj.justification || "Falta justificada via chamada",
        observations: "",
        registeredBy: "Sistema",
        isLeader: true
      }));
    }

    const all = [...formatted, ...formattedLeaders]
      .sort((a, b) => new Date(b.dateRaw).getTime() - new Date(a.dateRaw).getTime())
      .map(({ dateRaw, ...rest }) => rest);

    return NextResponse.json(all);
  } catch (error) {
    console.error("Erro ao buscar justificativas:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
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
        organizationId: activeOrganizationId,
        active: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Estudante não encontrado nesta organização" },
        { status: 404 }
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

      const csa = await prisma.classStaffAssignment.findFirst({
        where: {
          organizationMembershipId: membership.id,
          classId: student.classId,
          organizationId: activeOrganizationId,
          active: true,
        },
      });

      if (!csa) {
        return NextResponse.json(
          { error: "Acesso negado: Estudante não pertence a uma turma atribuída a este usuário" },
          { status: 403 }
        );
      }
    } else if (!isManager) {
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
          organizationId: activeOrganizationId,
        },
      });

      if (existingJustification) {
        return await tx.absenceJustification.update({
          where: { id: existingJustification.id },
          data: {
            reason,
            observations,
            registeredById: user.id,
          },
        });
      }

      return await tx.absenceJustification.create({
        data: {
          studentId,
          date: parsedDate,
          reason,
          observations,
          organizationId: activeOrganizationId,
          registeredById: user.id,
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
