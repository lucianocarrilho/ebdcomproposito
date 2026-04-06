import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/notifications
// Retrieves active notifications for the current user and check for upcoming birthdays
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userId = (session.user as any).id;
    const userRole = (session?.user as any)?.role;
    const userClassId = (session?.user as any)?.classId;

    // 1. Fetch Global or Targeted Notifications
    const dbNotifications = await prisma.notification.findMany({
      where: {
        active: true,
        OR: [
          { userId: null }, // Global broadcast
          { userId: userId } // Personal alert
        ],
        expiresAt: {
          gt: new Date()
        }
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
      // We check students from current professor's class or all if admin
      const studentsWhere = userRole === "ADMIN" || userRole === "DIRIGENTE" 
        ? { active: true } 
        : { active: true, classId: userClassId };

      if (userRole === "ADMIN" || userRole === "DIRIGENTE" || userClassId) {
        const allStudents = await prisma.student.findMany({
          where: studentsWhere,
          select: { id: true, name: true, birthDate: true, class: { select: { name: true } } }
        });

        allStudents.forEach(s => {
          if (!s.birthDate) return;
          
          const bday = new Date(s.birthDate);
          const bdayThisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
          
          // If bday already passed this year, check next year
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
      // We continue with empty birthdays but keep coordination notices
    }

    // Combine and format
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

// POST /api/notifications (COORDENACAO ONLY)
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || (session.user as any).role === "PROFESSOR") {
       return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { title, message, type, expiresAt, targetUserId } = await req.json();

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type: type || "info",
        userId: targetUserId || null,
        senderId: (session.user as any).id,
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days default
      }
    });

    return NextResponse.json(notification);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar notificação" }, { status: 500 });
  }
}
