import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AttendanceStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const classId = searchParams.get("classId");
  const type = searchParams.get("type") || "classe";

  try {
    const fromDate = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = endDate ? new Date(endDate) : new Date();

    const classWhere: any = {};
    if (classId && classId !== "Todas") {
      classWhere.id = classId;
    }

    // --- 1. HANDLE BIRTHDAYS (ANIVERSARIANTES) ---
    if (type === "aniversariantes") {
      const students = await prisma.student.findMany({
        where: {
          active: true,
          ...(classId && classId !== "Todas" ? { classId } : {}),
        },
        include: { class: true },
        orderBy: { birthDate: "asc" },
      });

      // Filter in-memory for precision with month/day across any year
      const filteredAniversariantes = students.filter(s => {
        if (!s.birthDate) return false;
        const bMonth = s.birthDate.getUTCMonth();
        const bDay = s.birthDate.getUTCDate();
        
        const currentYear = new Date().getFullYear();
        const bThisYear = new Date(currentYear, bMonth, bDay);
        
        return bThisYear >= fromDate && bThisYear <= toDate;
      }).map(s => ({
        id: s.id,
        name: s.name,
        date: s.birthDate,
        classe: s.class.name,
        photo: s.photo
      }));

      return NextResponse.json({ aniversariantes: filteredAniversariantes });
    }

    // --- 2. HANDLE INDIVIDUAL STUDENT FREQUENCY (POR ALUNO) ---
    if (type === "aluno") {
      const students = await prisma.student.findMany({
        where: {
          active: true,
          ...(classId && classId !== "Todas" ? { classId } : {}),
        },
        include: {
          class: true,
          attendanceItems: {
            where: {
              record: {
                date: { gte: fromDate, lte: toDate },
              },
            }
          }
        },
      });

      const studentData = students.map(s => {
        const total = s.attendanceItems.length;
        const presencas = s.attendanceItems.filter(i => i.status === AttendanceStatus.PRESENTE).length;
        const faltas = s.attendanceItems.filter(i => i.status === AttendanceStatus.FALTA).length;
        const justificadas = s.attendanceItems.filter(i => i.status === AttendanceStatus.FALTA_JUSTIFICADA).length;
        const freq = total > 0 ? Math.round((presencas / total) * 100) : 0;

        return {
          id: s.id,
          name: s.name,
          classe: s.class.name,
          freq,
          presencas,
          faltas,
          justificadas,
          photo: s.photo
        };
      }).sort((a, b) => b.freq - a.freq);

      return NextResponse.json({ students: studentData });
    }

    // --- 3. HANDLE CLASS SUMMARY (DEFAULT) ---
    const classes = await prisma.class.findMany({
      where: classWhere,
      include: {
        _count: {
          select: {
            students: { where: { active: true } },
          },
        },
        attendanceRecords: {
          where: { date: { gte: fromDate, lte: toDate } },
          include: {
            items: {
              select: { status: true },
            },
          },
        },
      },
    });

    const classData = classes.map((c) => {
      const matriculados = c._count.students;
      let totalItems = 0;
      let presencas = 0;
      let faltas = 0;
      let justificadas = 0;

      c.attendanceRecords.forEach((record) => {
        record.items.forEach((item) => {
          totalItems++;
          if (item.status === AttendanceStatus.PRESENTE) presencas++;
          if (item.status === AttendanceStatus.FALTA) faltas++;
          if (item.status === AttendanceStatus.FALTA_JUSTIFICADA) justificadas++;
        });
      });

      const mediaFreq = totalItems > 0 ? Math.round((presencas / totalItems) * 100) : 0;

      return {
        id: c.id,
        classe: c.name,
        matriculados,
        ativos: matriculados, // Simplified for now
        mediaFreq,
        faltas,
        justificadas,
      };
    });

    // 2. Calculate Global Summary
    const totalStudents = classData.reduce((acc, curr) => acc + curr.matriculados, 0);
    const totalFaltas = classData.reduce((acc, curr) => acc + curr.faltas, 0);
    const totalJustificadas = classData.reduce((acc, curr) => acc + curr.justificadas, 0);
    
    // Weighted Average Frequency
    const totalPresencas = classData.reduce((acc, curr) => {
      // Calculate back presences from mediaFreq for total items if we had total items here
      // But let's just calculate from classes directly for accuracy
      return acc;
    }, 0);

    // Re-calculating global for accuracy
    let globalTotalItems = 0;
    let globalPresencas = 0;
    classes.forEach(c => {
      c.attendanceRecords.forEach(r => {
        r.items.forEach(i => {
          globalTotalItems++;
          if (i.status === AttendanceStatus.PRESENTE) globalPresencas++;
        });
      });
    });

    const generalFreq = globalTotalItems > 0 ? Math.round((globalPresencas / globalTotalItems) * 100) : 0;

    return NextResponse.json({
      summary: {
        totalStudents,
        generalFreq,
        totalFaltas,
        totalJustificadas,
      },
      classData,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: "Erro ao gerar relatório" }, { status: 500 });
  }
}
