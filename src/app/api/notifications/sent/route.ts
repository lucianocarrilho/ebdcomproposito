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

    const notifications = await prisma.notification.findMany({
      where: userRole === "ADMIN" ? {} : {
        active: true,
        senderId: userId
      },
      include: {
        reads: {
          take: 50,
          select: {
            user: {
              select: { name: true }
            }
          }
        },
        _count: {
          select: { reads: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return NextResponse.json(notifications);
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
