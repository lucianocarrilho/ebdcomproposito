import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const notificationId = searchParams.get("id");

    if (!notificationId) return NextResponse.json({ error: "ID não fornecido" }, { status: 400 });

    const userId = session.user.id;
    if (!userId) return NextResponse.json({ error: "ID de usuário inválido" }, { status: 400 });

    await prisma.notificationRead.upsert({
      where: {
        notificationId_userId: {
          notificationId,
          userId
        }
      },
      update: {
        readAt: new Date()
      },
      create: {
        notificationId,
        userId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao marcar como lido" }, { status: 500 });
  }
}
