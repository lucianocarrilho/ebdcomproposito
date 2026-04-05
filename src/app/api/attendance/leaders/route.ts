import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    
    if (!dateStr) {
      return NextResponse.json({ error: "Data não informada" }, { status: 400 });
    }

    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);

    const attendance = await prisma.leaderAttendance.findMany({
      where: { date }
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("Erro ao buscar presença da liderança:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { date: dateStr, items } = await request.json();
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);

    // Salvar cada item de presença
    const promises = items.map((item: any) => {
      return prisma.leaderAttendance.upsert({
        where: {
          leaderId_date: {
            leaderId: item.leaderId,
            date
          }
        },
        update: {
          status: item.status,
          justification: item.justification
        },
        create: {
          leaderId: item.leaderId,
          date,
          status: item.status,
          justification: item.justification
        }
      });
    });

    await Promise.all(promises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao salvar presença da liderança:", error);
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
  }
}
