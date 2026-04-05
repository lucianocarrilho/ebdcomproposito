import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userRole = (session.user as any).role;
    const userClassId = (session.user as any).classId;
    const userName = session.user?.name || "";

    const where: any = {};

    // Se for professor, filtrar apenas alunos das turmas dele
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
      where.student = { classId: { in: classIds } };
    }

    const justifications = await prisma.absenceJustification.findMany({
      where,
      include: {
        student: { select: { name: true, class: { select: { name: true } } } },
        registeredBy: { select: { name: true } }
      },
      orderBy: { date: "desc" }
    });

    const formatted = justifications.map(j => ({
      id: j.id,
      studentName: j.student.name,
      className: j.student.class.name,
      date: j.date.toLocaleDateString("pt-BR"),
      reason: j.reason,
      observations: j.observations || "",
      registeredBy: j.registeredBy?.name || "Sistema"
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Erro ao buscar justificativas:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { studentId, date, reason, observations } = body;

    const justification = await prisma.absenceJustification.create({
      data: {
        studentId,
        date: new Date(date),
        reason,
        observations,
        registeredById: session.user?.id
      },
      include: {
        student: { select: { name: true } },
        registeredBy: { select: { name: true } }
      }
    });

    return NextResponse.json(justification);
  } catch (error) {
    console.error("Erro ao criar justificativa:", error);
    return NextResponse.json({ error: "Erro ao criar" }, { status: 500 });
  }
}
