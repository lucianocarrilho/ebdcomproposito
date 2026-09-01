import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireOrganization, getUserAssignedClasses } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { studentId, date, reason, observations } = body;

    const justification = await prisma.absenceJustification.create({
      data: {
        studentId,
        date: new Date(date),
        reason,
        observations,
        registeredById: session.user?.id
      },
      include: {
        student: { select: { name: true } },
        registeredBy: { select: { name: true } }
      }
    });

    return NextResponse.json(justification);
  } catch (error) {
    console.error("Erro ao criar justificativa:", error);
    return NextResponse.json({ error: "Erro ao criar" }, { status: 500 });
  }
}
