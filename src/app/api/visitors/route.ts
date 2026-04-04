import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const visitors = await prisma.visitor.findMany({
      include: {
        class: true,
        invitedBy: true,
      },
      orderBy: { date: "desc" },
    });

    // Calculate ranking
    const rankingRaw = await prisma.visitor.groupBy({
      by: ['invitedById'],
      _count: {
        id: true,
      },
      where: {
        invitedById: { not: null }
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 5
    });

    // Get student details for ranking
    const ranking = await Promise.all(rankingRaw.map(async (item) => {
      const student = await prisma.student.findUnique({
        where: { id: item.invitedById as string },
        include: { class: true }
      });
      return {
        nome: student?.name || "Desconhecido",
        visitantes: item._count.id,
        classe: student?.class?.name || "—",
        mimoEntregue: false // This could be a real field in the future
      };
    }));

    return NextResponse.json({ visitors, ranking });
  } catch (error) {
    console.error("Error fetching visitors:", error);
    return NextResponse.json({ error: "Erro ao carregar visitantes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, date, classId, invitedById, observations } = body;

    const visitor = await prisma.visitor.create({
      data: {
        name,
        date: new Date(date),
        classId,
        invitedById: invitedById || null,
        observations,
      },
    });

    return NextResponse.json(visitor);
  } catch (error) {
    console.error("Error creating visitor:", error);
    return NextResponse.json({ error: "Erro ao registrar visitante" }, { status: 500 });
  }
}
