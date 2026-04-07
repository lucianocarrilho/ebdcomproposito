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

    // Absolute diagnostic: Fetch everything with NO filters
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 50
    });

    if (notifications.length === 0) return NextResponse.json([]);

    // 2. Fetch reads separately for these notifications (safer join)
    const notificationIds = notifications.map(n => n.id);
    const allReads = await prisma.notificationRead.findMany({
      where: {
        notificationId: { in: notificationIds }
      },
      include: {
        user: {
          select: { name: true }
        }
      }
    });

    // 3. Manual join in memory
    const formatted = notifications.map(notif => ({
      ...notif,
      _count: {
        reads: allReads.filter(r => r.notificationId === notif.id).length
      },
      reads: allReads
        .filter(r => r.notificationId === notif.id)
        .map(r => ({ user: { name: r.user.name } }))
        .slice(0, 50)
    }));

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
