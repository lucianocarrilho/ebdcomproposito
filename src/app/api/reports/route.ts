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
    const fromDate = startDate ? new Date(`${startDate}T00:00:00.000Z`) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = endDate ? new Date(`${endDate}T23:59:59.999Z`) : new Date();

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

      const users = await prisma.user.findMany({
        where: {
          active: true,
          birthDate: { not: null },
          ...(classId && classId !== "Todas" ? { classId } : {}),
        },
        select: {
          id: true,
          name: true,
          birthDate: true,
          image: true,
          role: true
        }
      });

      const allMembers = [
        ...students,
        ...users.map(u => ({
          id: u.id,
          name: u.name,
          birthDate: u.birthDate,
          photo: u.image,
          class: { name: `Equipe (${u.role})` }
        }))
      ];

      // Filter in-memory for precision with month/day across any year
      const filteredAniversariantes = allMembers.filter(s => {
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

    // --- 3. HANDLE VISITORS (VISITANTES) ---
    if (type === "visitantes") {
      const visitors = await prisma.visitor.findMany({
        where: {
          date: { gte: fromDate, lte: toDate },
          ...(classId && classId !== "Todas" ? { classId } : {}),
        },
        include: {
          class: true,
          invitedBy: true
        },
        orderBy: { date: "desc" }
      });

      const visitantes = visitors.map(v => ({
        id: v.id,
        name: v.name,
        date: v.date,
        classe: v.class.name,
        convidadoPor: v.invitedBy ? v.invitedBy.name : "-",
        observations: v.observations
      }));

      return NextResponse.json({ visitantes });
    }

    // --- 4. HANDLE LEADERSHIP FREQUENCY (LIDERANÇA) ---
    if (type === "lideranca") {
      const leaders = await prisma.leader.findMany({
        where: { active: true },
        include: {
          class: true,
          attendance: {
            where: {
              date: { gte: fromDate, lte: toDate },
            },
          },
        },
      });

      const leaderData = leaders.map(l => {
        const total = l.attendance.length;
        const presencas = l.attendance.filter(a => a.status === AttendanceStatus.PRESENTE).length;
        const faltas = l.attendance.filter(a => a.status === AttendanceStatus.FALTA).length;
        const justificadas = l.attendance.filter(a => a.status === AttendanceStatus.FALTA_JUSTIFICADA).length;
        const freq = total > 0 ? Math.round((presencas / total) * 100) : 0;

        return {
          id: l.id,
          name: l.name,
          role: l.role,
          classe: l.class?.name || "Geral",
          freq,
          presencas,
          faltas,
          justificadas,
          total,
          photo: l.photo,
        };
      }).sort((a, b) => b.freq - a.freq);

      // Summary
      const totalLeaders = leaderData.length;
      let globalItems = 0;
      let globalPresencas = 0;
      let globalFaltas = 0;
      let globalJustificadas = 0;
      leaders.forEach(l => {
        l.attendance.forEach(a => {
          globalItems++;
          if (a.status === AttendanceStatus.PRESENTE) globalPresencas++;
          if (a.status === AttendanceStatus.FALTA) globalFaltas++;
          if (a.status === AttendanceStatus.FALTA_JUSTIFICADA) globalJustificadas++;
        });
      });
      const generalFreq = globalItems > 0 ? Math.round((globalPresencas / globalItems) * 100) : 0;

      return NextResponse.json({
        summary: {
          totalLeaders,
          generalFreq,
          totalFaltas: globalFaltas,
          totalJustificadas: globalJustificadas,
        },
        leaders: leaderData,
      });
    }

    // --- 5. HANDLE CLASS SUMMARY (DEFAULT) ---
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

      let biblias = 0;
      let revistas = 0;
      let ofertas = 0;
      let outros = 0;

      c.attendanceRecords.forEach((record) => {
        biblias += record.biblias;
        revistas += record.revistas;
        ofertas += Number(record.ofertas);
        outros += record.outros;

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
        biblias,
        revistas,
        ofertas,
        outros,
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

    const totalBiblias = classData.reduce((acc, curr) => acc + curr.biblias, 0);
    const totalRevistas = classData.reduce((acc, curr) => acc + curr.revistas, 0);
    const totalOfertas = classData.reduce((acc, curr) => acc + curr.ofertas, 0);
    const totalOutros = classData.reduce((acc, curr) => acc + curr.outros, 0);

    return NextResponse.json({
      summary: {
        totalStudents,
        generalFreq,
        totalFaltas,
        totalJustificadas,
        totalBiblias,
        totalRevistas,
        totalOfertas,
        totalOutros,
      },
      classData,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: "Erro ao gerar relatório" }, { status: 500 });
  }
}
