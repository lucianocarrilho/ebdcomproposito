import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
        }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    // 2. Dynamic Birthday Check (7-day window)
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    // We check students from current professor's class or all if admin
    const studentsWhere = userRole === "ADMIN" || userRole === "DIRIGENTE" 
      ? { active: true } 
      : { active: true, classId: userClassId };

    const allStudents = await prisma.student.findMany({
      where: studentsWhere,
      select: { id: true, name: true, birthDate: true, class: { select: { name: true } } }
    });

    const birthdayNotifications: any[] = [];
    allStudents.forEach(s => {
      if (!s.birthDate) return;
      
      const bday = new Date(s.birthDate);
      const bdayThisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      
      // If bday already passed this year, check next year (e.g. late Dec -> early Jan check)
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

    // Combine and format
    const finalNotifications = [
       {
         id: "welcome-notice",
         title: "✨ Bem-vindo ao Novo Painel!",
         message: "Aqui Amara, você verá avisos da secretaria e aniversariantes da sua classe.",
         type: "success",
         createdAt: new Date(),
         isRead: false
       },
       ...birthdayNotifications,
       ...dbNotifications.map(n => ({
          ...n,
          isRead: n.reads.length > 0
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
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days default
      }
    });

    return NextResponse.json(notification);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao criar notificação" }, { status: 500 });
  }
}
