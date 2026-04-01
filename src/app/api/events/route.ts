import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Listar eventos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    const where: Record<string, unknown> = {};
    if (month && year) {
      const m = parseInt(month);
      const y = parseInt(year);
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0, 23, 59, 59);
      where.date = { gte: start, lte: end };
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { date: "asc" },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("Erro ao buscar eventos:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar evento
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, date, endDate, type, allDay } = body;

    if (!title || !date) {
      return NextResponse.json({ error: "Título e data são obrigatórios" }, { status: 400 });
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : null,
        type: type || "evento",
        allDay: allDay ?? true,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar evento:", error);
    return NextResponse.json({ error: "Erro ao criar" }, { status: 500 });
  }
}
