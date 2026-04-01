import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Listar visitantes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get("quarter");

    const where: Record<string, unknown> = {};
    if (quarter) {
      // Filter by quarter date range
      const [year, q] = quarter.split("-Q");
      const qNum = parseInt(q);
      const startMonth = (qNum - 1) * 3;
      const start = new Date(parseInt(year), startMonth, 1);
      const end = new Date(parseInt(year), startMonth + 3, 0);
      where.date = { gte: start, lte: end };
    }

    const visitors = await prisma.visitor.findMany({
      where,
      include: {
        class: { select: { name: true } },
        invitedBy: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    // Get ranking
    const ranking = await prisma.visitor.groupBy({
      by: ["invitedById"],
      _count: { id: true },
      where: { invitedById: { not: null }, ...where },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    // Enrich ranking with student info
    const enrichedRanking = await Promise.all(
      ranking.map(async (r) => {
        if (!r.invitedById) return null;
        const student = await prisma.student.findUnique({
          where: { id: r.invitedById },
          include: { class: { select: { name: true } } },
        });
        return {
          studentId: r.invitedById,
          nome: student?.name || "Desconhecido",
          classe: student?.class?.name || "",
          visitantes: r._count.id,
        };
      })
    );

    return NextResponse.json({
      visitors,
      ranking: enrichedRanking.filter(Boolean),
    });
  } catch (error) {
    console.error("Erro ao buscar visitantes:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Registrar visitante
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, date, classId, invitedById, observations } = body;

    if (!name || !date || !classId) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const visitor = await prisma.visitor.create({
      data: {
        name,
        date: new Date(date),
        classId,
        invitedById: invitedById || null,
        observations,
      },
      include: {
        class: { select: { name: true } },
        invitedBy: { select: { name: true } },
      },
    });

    // Update visitor points
    if (invitedById) {
      const now = new Date();
      const q = Math.ceil((now.getMonth() + 1) / 3);
      const quarter = `${now.getFullYear()}-Q${q}`;

      await prisma.studentVisitorPoint.upsert({
        where: {
          studentId_quarter: { studentId: invitedById, quarter },
        },
        create: { studentId: invitedById, quarter, points: 1 },
        update: { points: { increment: 1 } },
      });
    }

    return NextResponse.json(visitor, { status: 201 });
  } catch (error) {
    console.error("Erro ao registrar visitante:", error);
    return NextResponse.json({ error: "Erro ao registrar" }, { status: 500 });
  }
}
