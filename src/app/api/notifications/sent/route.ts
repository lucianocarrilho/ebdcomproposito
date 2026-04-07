import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    // 1. Fetch notifications
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 50
    });

    if (notifications.length === 0) return NextResponse.json([]);

    // 2. Fetch all reads for these notifications (Basic fields only, to avoid missing 'user' relation)
    const notificationIds = notifications.map(n => n.id);
    const allReads = await prisma.notificationRead.findMany({
      where: {
        notificationId: { in: notificationIds }
      }
    });

    // 3. Fetch all users involved in these reads separately
    const userIds = Array.from(new Set(allReads.map(r => r.userId)));
    const allUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true }
    });

    // 4. Manual triple join in memory
    const formatted = notifications.map(notif => {
      const readsForNotif = allReads.filter(r => r.notificationId === notif.id);
      
      return {
        ...notif,
        _count: {
          reads: readsForNotif.length
        },
        reads: readsForNotif.map(r => {
          const user = allUsers.find(u => u.id === r.userId);
          return {
            user: { name: user?.name || "Usuário" }
          };
        }).slice(0, 50)
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("Erro ao buscar avisos enviados:", error);
    return NextResponse.json({ 
      error: "Erro interno", 
      details: error.message || "Sem detalhes" 
    }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID não fornecido" }, { status: 400 });

    await prisma.notification.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir aviso:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
