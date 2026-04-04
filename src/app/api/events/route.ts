import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // 0-11
    const year = searchParams.get("year");

    if (!month || !year) {
      return NextResponse.json({ error: "Mês e ano são obrigatórios" }, { status: 400 });
    }

    const m = parseInt(month);
    const y = parseInt(year);

    // Fetch manual events
    const startOfMonth = new Date(Date.UTC(y, m, 1));
    const endOfMonth = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));

    const manualEvents = await prisma.event.findMany({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // Fetch student birthdays for this month
    const students = await prisma.student.findMany({
      where: {
        active: true,
        birthDate: { not: null },
      },
      select: {
        name: true,
        birthDate: true,
      },
    });

    const birthdayEvents = students
      .filter((s) => s.birthDate && s.birthDate.getUTCMonth() === m)
      .map((s) => ({
        id: `bday-${s.name}-${s.birthDate?.toISOString()}`,
        title: `Niver: ${s.name.split(" ")[0]}`,
        date: new Date(Date.UTC(y, m, s.birthDate!.getUTCDate())),
        type: "aniversario",
      }));

    // Combine and format
    const allEvents = [
      ...manualEvents.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        type: e.type,
      })),
      ...birthdayEvents,
    ];

    return NextResponse.json(allEvents);
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json({ error: "Erro ao carregar calendário" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, date, type, description } = body;

    const event = await prisma.event.create({
      data: {
        title,
        date: new Date(date),
        type,
        description,
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json({ error: "Erro ao registrar evento" }, { status: 500 });
  }
}
