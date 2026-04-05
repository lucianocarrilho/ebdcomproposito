import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AttendanceStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
  
  // Usar split e Date.UTC para evitar deslocamento de fuso horário
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

  try {
    // 1. Buscar todas as classes ativas (campo status no prisma)
    const classes = await prisma.class.findMany({
      where: { status: true },
      include: {
        _count: {
          select: { students: { where: { active: true } } }
        },
        attendanceRecords: {
          where: { 
            date: { 
              gte: date, 
              lt: nextDay 
            } 
          },
          include: {
            items: true
          }
        },
        visitors: {
          where: { date: { gte: date, lt: nextDay } }
        }
      },
      orderBy: { name: "asc" }
    });

    const reportData = classes.map(c => {
      const enrolled = c._count.students;
      const record = c.attendanceRecords[0]; 
      
      let present = 0;
      let absent = 0;
      let justified = 0;
      
      if (record) {
        record.items.forEach((item: any) => {
          if (item.status === AttendanceStatus.PRESENTE) present++;
          else if (item.status === AttendanceStatus.FALTA) absent++;
          else if (item.status === AttendanceStatus.FALTA_JUSTIFICADA) justified++;
        });
      }

      const totalVisitors = c.visitors.length;

      return {
        id: c.id,
        className: c.name,
        enrolled,
        present,
        absent,
        justified,
        visitors: totalVisitors,
        freq: enrolled > 0 ? Math.round((present / enrolled) * 100) : 0
      };
    });

    // 2. Totais Gerais
    const summary = {
      totalEnrolled: reportData.reduce((acc, curr) => acc + curr.enrolled, 0),
      totalPresent: reportData.reduce((acc, curr) => acc + curr.present, 0),
      totalAbsent: reportData.reduce((acc, curr) => acc + curr.absent, 0),
      totalJustified: reportData.reduce((acc, curr) => acc + curr.justified, 0),
      totalVisitors: reportData.reduce((acc, curr) => acc + curr.visitors, 0),
      schoolFreq: 0
    };

    if (summary.totalEnrolled > 0) {
      summary.schoolFreq = Math.round((summary.totalPresent / summary.totalEnrolled) * 100);
    }

    return NextResponse.json({
      date: dateStr,
      summary,
      classes: reportData
    });
  } catch (error) {
    console.error("Erro ao gerar mapa do dia:", error);
    return NextResponse.json({ error: "Erro ao gerar mapa do dia" }, { status: 500 });
  }
}
