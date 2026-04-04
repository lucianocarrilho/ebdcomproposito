import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userClassId = (session.user as any).classId;
    const userName = session.user?.name || "";

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // 0-11
    const year = searchParams.get("year");

    if (!month || !year) {
      return NextResponse.json({ error: "Mês e ano são obrigatórios" }, { status: 400 });
    }

    const m = parseInt(month);
    const y = parseInt(year);

    // Fetch manual events (Anúncios/Festividades - VISÍVEIS PARA TODOS)
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

    // Fetch student birthdays for this month (FILTRADOS POR NÍVEL DE ACESSO)
    const studentsWhere: any = {
      active: true,
      birthDate: { not: null },
    };

    // Enforcement: Professors only see birthdays from their own class(es)
    if (userRole === "PROFESSOR") {
      const teacherClasses = await prisma.class.findMany({
        where: {
          OR: [
            { id: userClassId || undefined },
            { professor: { contains: userName } }
          ]
        },
        select: { id: true }
      });
      const classIds = teacherClasses.map(c => c.id);
      studentsWhere.classId = { in: classIds };
    }

    const students = await prisma.student.findMany({
      where: studentsWhere,
      select: {
        name: true,
        birthDate: true,
      },
    });

    const birthdayEvents = students
      .filter((s) => s.birthDate && s.birthDate.getUTCMonth() === m)
      .map((s) => ({
        id: `bday-${s.name}-${s.birthDate?.toISOString()}`,
        title: `🎂 Niver: ${s.name.split(" ")[0]}`,
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
    const session = await auth();
    // Somente ADMIN pode agendar novos eventos gerais
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Somente administradores podem agendar eventos" }, { status: 403 });
    }

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

