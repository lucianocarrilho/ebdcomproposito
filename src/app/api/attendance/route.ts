import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";

// GET - Buscar chamada por data e classe
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");

    if (!classId || !date) {
      return NextResponse.json(
        { error: "classId e date são obrigatórios" },
        { status: 400 }
      );
    }

    const parsedDate = new Date(date + "T00:00:00.000Z");

    // Get existing record
    const record = await prisma.attendanceRecord.findUnique({
      where: {
        date_classId: { date: parsedDate, classId },
      },
      include: {
        items: {
          include: { student: { select: { id: true, name: true } } },
        },
      },
    });

    // Get all students for the class
    const students = await prisma.student.findMany({
      where: { classId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    // Merge data
    const attendanceList = students.map((student) => {
      const item = record?.items.find((i) => i.studentId === student.id);
      return {
        studentId: student.id,
        studentName: student.name,
        status: item?.status || "",
        observations: item?.observations || "",
      };
    });

    return NextResponse.json({
      record: record || null,
      students: attendanceList,
    });
  } catch (error) {
    console.error("Erro ao buscar presença:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Salvar chamada
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { classId, date, observations, items } = body;

    if (!classId || !date || !items?.length) {
      return NextResponse.json(
        { error: "Dados incompletos" },
        { status: 400 }
      );
    }

    const parsedDate = new Date(date + "T00:00:00.000Z");

    // Upsert the record
    const record = await prisma.attendanceRecord.upsert({
      where: {
        date_classId: { date: parsedDate, classId },
      },
      create: {
        date: parsedDate,
        classId,
        observations,
      },
      update: {
        observations,
      },
    });

    // Delete existing items and recreate
    await prisma.attendanceItem.deleteMany({
      where: { recordId: record.id },
    });

    // Create attendance items
    const validItems = items.filter(
      (item: { status: string }) => item.status && item.status !== ""
    );

    if (validItems.length > 0) {
      await prisma.attendanceItem.createMany({
        data: validItems.map((item: { studentId: string; status: AttendanceStatus; observations?: string }) => ({
          recordId: record.id,
          studentId: item.studentId,
          status: item.status,
          observations: item.observations || null,
        })),
      });
    }

    // Also update justifications for FALTA_JUSTIFICADA
    // (auto-create justification records)
    const justifiedItems = validItems.filter(
      (item: { status: string }) => item.status === "FALTA_JUSTIFICADA"
    );

    for (const item of justifiedItems) {
      // Verificar se já existe justificativa para este aluno nesta data
      const existing = await prisma.absenceJustification.findFirst({
        where: {
          studentId: item.studentId,
          date: parsedDate,
        },
      });

      if (!existing) {
        await prisma.absenceJustification.create({
          data: {
            studentId: item.studentId,
            date: parsedDate,
            reason: "Falta justificada via chamada",
          },
        });
      }
    }

    return NextResponse.json({ success: true, recordId: record.id });
  } catch (error) {
    console.error("Erro ao salvar presença:", error);
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
  }
}
