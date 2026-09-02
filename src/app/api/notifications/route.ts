import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrganization, getUserAssignedClasses } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/notifications
// Retrieves active notifications for the current user and check for upcoming birthdays
export async function GET(req: NextRequest) {
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

    const userId = user.id;
    const now = new Date();

    // 1. Fetch Global or Targeted Notifications
    const dbNotifications = await prisma.notification.findMany({
      where: {
        active: true,
        AND: [
          {
            OR: [
              { organizationId: activeOrganizationId, userId: null },
              { organizationId: activeOrganizationId, userId: userId },
              { organizationId: null, userId: null },
              { organizationId: null, userId: userId }
            ]
          },
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } }
            ]
          }
        ]
      },
      include: {
        reads: {
          where: { userId: userId }
        },
        sender: {
          select: { name: true, image: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    const birthdayNotifications: any[] = [];
    const today = new Date();

    try {
      let canCheckBirthdays = false;
      let studentsWhere: any = null;

      if (isManager) {
        canCheckBirthdays = true;
        studentsWhere = {
          active: true,
          organizationId: activeOrganizationId,
          class: {
            organizationId: activeOrganizationId,
            status: true
          }
        };
      } else if (isRestricted && membership?.id) {
        const { classIds } = await getUserAssignedClasses(userId, activeOrganizationId, membership.id);
        if (classIds && classIds.length > 0) {
          const activeClasses = await prisma.class.findMany({
            where: {
              id: { in: classIds },
              organizationId: activeOrganizationId,
              status: true
            },
            select: { id: true }
          });

          const assignedClassIds = activeClasses.map(c => c.id);
          if (assignedClassIds.length > 0) {
            canCheckBirthdays = true;
            studentsWhere = {
              active: true,
              organizationId: activeOrganizationId,
              classId: { in: assignedClassIds },
              class: {
                organizationId: activeOrganizationId,
                status: true
              }
            };
          }
        }
      }

      if (canCheckBirthdays && studentsWhere) {
        const allStudents = await prisma.student.findMany({
          where: studentsWhere,
          select: { id: true, name: true, birthDate: true, class: { select: { name: true } } }
        });

        allStudents.forEach(s => {
          if (!s.birthDate) return;

          const bday = new Date(s.birthDate);
          const bdayThisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());

          if (bdayThisYear < today && (today.getMonth() === 11 && bday.getMonth() === 0)) {
            bdayThisYear.setFullYear(today.getFullYear() + 1);
          }

          const diffDays = Math.ceil((bdayThisYear.getTime() - today.getTime()) / (1000 * 3600 * 24));

          if (diffDays >= 0 && diffDays <= 7) {
            birthdayNotifications.push({
              id: `bday-${s.id}`,
              title: "🎉 Aniversariante Próximo!",
              message: `${s.name} (${s.class?.name}) faz aniversário em ${diffDays === 0 ? 'HOJE!' : diffDays + ' dias.'}`,
              type: "birthday",
              createdAt: new Date(),
              isBirthday: true
            });
          }
        });
      }
    } catch (bdayError) {
      console.error("Erro ao processar aniversariantes:", bdayError);
    }

    const finalNotifications = [
      ...birthdayNotifications,
      ...dbNotifications.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        createdAt: n.createdAt,
        isRead: n.reads.length > 0,
        senderName: (n as any).sender?.name || "Coordenação"
      }))
    ];

    return NextResponse.json(finalNotifications);
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
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

    const isManager = globalAdminMode || (orgRole ? ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE"].includes(orgRole) : false);

    if (!isManager) {
      return NextResponse.json(
        { error: "Acesso negado: Cargo sem permissão para disparar comunicados" },
        { status: 403 }
      );
    }

    const body = await req.json();

    if ("organizationId" in body || "senderId" in body) {
      return NextResponse.json(
        { error: "Campos controlados pelo servidor não podem ser enviados pelo cliente" },
        { status: 400 }
      );
    }

    const { title, message, type, targetUserId, expiresAt } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: "title e message são obrigatórios" },
        { status: 400 }
      );
    }

    let parsedExpiresAt: Date | null = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (isNaN(parsedExpiresAt.getTime())) {
        return NextResponse.json(
          { error: "Data de expiração inválida" },
          { status: 400 }
        );
      }
      if (parsedExpiresAt.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: "Data de expiração deve ser no futuro" },
          { status: 400 }
        );
      }
    }

    if (targetUserId) {
      const targetMembership = await prisma.organizationMembership.findFirst({
        where: {
          userId: targetUserId,
          organizationId: activeOrganizationId,
          status: "ACTIVE",
        },
      });

      if (!targetMembership) {
        return NextResponse.json(
          { error: "Usuário destinatário não encontrado ou inativo nesta organização" },
          { status: 404 }
        );
      }
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type: type || "info",
        userId: targetUserId || null,
        senderId: user.id,
        organizationId: activeOrganizationId,
        expiresAt: parsedExpiresAt,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar notificação:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao disparar notificação" },
      { status: 500 }
    );
  }
}
