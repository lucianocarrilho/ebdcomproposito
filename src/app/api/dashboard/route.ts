import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET - Dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let selectedQuarter = searchParams.get("quarter");

    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    if (!selectedQuarter) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
      selectedQuarter = `${currentYear}-Q${currentQuarter}`;
    }

    const userRole = (session.user as any).role;
    const userClassId = (session.user as any).classId;
    const userName = session.user?.name || "";

    // Determine allowed classes for filtering
    let allowedClassIds: string[] | null = null;
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
      allowedClassIds = teacherClasses.map(c => c.id);
    }

    const studentWhere = allowedClassIds 
      ? { classId: { in: allowedClassIds }, active: true } 
      : { active: true };

    const classWhere = allowedClassIds ? { id: { in: allowedClassIds }, status: true } : { status: true };

    // Totals
    const [
      totalStudents,
      activeStudents,
      totalClasses,
      totalLeaders,
    ] = await Promise.all([
      prisma.student.count({ where: studentWhere }),
      prisma.student.count({ where: { ...studentWhere, active: true } }),
      prisma.class.count({ where: classWhere }),
      userRole === "ADMIN" 
        ? prisma.leader.count({ where: { active: true } }) 
        : Promise.resolve(0), // Leaders usually only visible to Admin
    ]);

    // Last Sunday attendance
    const today = new Date();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - today.getDay());
    lastSunday.setHours(0, 0, 0, 0);

    const attendanceWhere: any = {
      record: { date: { gte: lastSunday } },
    };
    if (allowedClassIds) {
      attendanceWhere.record.classId = { in: allowedClassIds };
    }

    const lastAttendance = await prisma.attendanceItem.groupBy({
      by: ["status"],
      _count: { id: true },
      where: attendanceWhere,
    });

    const getStatusCount = (status: AttendanceStatus) => 
      lastAttendance.find((a) => a.status === status)?._count.id || 0;

    const presentes = getStatusCount("PRESENTE");
    const faltas = getStatusCount("FALTA");
    const justificadas = getStatusCount("FALTA_JUSTIFICADA");

    // Birthday this month
    const currentMonth = today.getMonth() + 1;
    const aniversariantes = await prisma.student.findMany({
      where: {
        ...studentWhere,
        active: true,
        birthDate: { not: null },
      },
      select: {
        id: true,
        name: true,
        birthDate: true,
        photo: true,
        class: { select: { name: true } },
      },
    });

    const aniversariantesUsers = await prisma.user.findMany({
      where: {
        active: true,
        birthDate: { not: null },
      },
      select: {
        id: true,
        name: true,
        birthDate: true,
        image: true,
        role: true,
      },
    });

    const allAniversariantes = [
      ...aniversariantes,
      ...aniversariantesUsers.map(u => ({ 
        id: u.id, 
        name: u.name, 
        birthDate: u.birthDate, 
        photo: u.image, 
        class: { name: `Equipe (${u.role})` } 
      }))
    ];

    const aniversariantesDoMes = allAniversariantes.filter((a) => {
      if (!a.birthDate) return false;
      return a.birthDate.getUTCMonth() + 1 === currentMonth;
    });

    // Attendance by class
    const classes = await prisma.class.findMany({
      where: classWhere,
      select: { id: true, name: true },
    });

    const attendanceByClass = await Promise.all(
      classes.map(async (cls) => {
        const items = await prisma.attendanceItem.groupBy({
          by: ["status"],
          _count: { id: true },
          where: {
            record: { classId: cls.id, date: { gte: lastSunday } },
          },
        });

        const getClsStatusCount = (status: AttendanceStatus) => 
          items.find((i) => i.status === status)?._count.id || 0;

        return {
          classe: cls.name,
          presentes: getClsStatusCount("PRESENTE"),
          faltas: getClsStatusCount("FALTA"),
          justificadas: getClsStatusCount("FALTA_JUSTIFICADA"),
        };
      })
    );

    // Weekly evolution (last 5 weeks)
    const weeklyData = [];
    for (let w = 4; w >= 0; w--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() - w * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const wkWhere: any = {
        record: { date: { gte: weekStart, lt: weekEnd } },
      };
      if (allowedClassIds) {
        wkWhere.record.classId = { in: allowedClassIds };
      }

      const items = await prisma.attendanceItem.groupBy({
        by: ["status"],
        _count: { id: true },
        where: wkWhere,
      });

      const getWkStatusCount = (status: AttendanceStatus) => 
        items.find((i) => i.status === status)?._count.id || 0;

      weeklyData.push({
        semana: `Sem ${5 - w}`,
        presenca: getWkStatusCount("PRESENTE"),
        faltas: getWkStatusCount("FALTA"),
      });
    }

    // Highlights
    // Convert "2026-Q2" to "2º Trimestre 2026" format to match records
    const quarterToHumanReadable = (q: string) => {
      const [yearStr, qStr] = q.split("-");
      const num = qStr.replace("Q", "");
      return `${num}º Trimestre ${yearStr}`;
    };
    const quarterHuman = quarterToHumanReadable(selectedQuarter);

    const highlightWhere: any = { 
      quarter: { in: [selectedQuarter, quarterHuman] } 
    };
    if (allowedClassIds) {
      highlightWhere.classId = { in: allowedClassIds };
    }

    // Calcular o ranqueamento por frequência do trimestre selecionado
    const getQuarterDateRange = (quarterStr: string) => {
      const [yearStr, qStr] = quarterStr.split("-");
      const year = parseInt(yearStr);
      const q = parseInt(qStr.replace("Q", ""));
      
      const startMonth = (q - 1) * 3;
      const startDate = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999));
      
      return { startDate, endDate };
    };

    const { startDate, endDate } = getQuarterDateRange(selectedQuarter);

    const studentsWithAttendance = await prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        name: true,
        photo: true,
        class: { select: { id: true, name: true } },
        attendanceItems: {
          where: {
            status: "PRESENTE",
            record: {
              date: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
          select: { id: true },
        },
      },
    });

    const ranking = (() => {
      const studentsMapped = studentsWithAttendance
        .map((student) => ({
          id: student.id,
          name: student.name.trim(),
          photo: student.photo,
          classId: student.class?.id || "sem-classe",
          className: student.class?.name || "Sem Classe",
          presences: student.attendanceItems.length,
        }))
        .filter((s) => s.presences > 0);

      // Agrupar por classe e pegar apenas o aluno com mais presenças de cada classe
      const classChampionsMap = new Map<string, typeof studentsMapped[0]>();
      
      for (const student of studentsMapped) {
        const existingChampion = classChampionsMap.get(student.classId);
        if (!existingChampion || student.presences > existingChampion.presences) {
          classChampionsMap.set(student.classId, student);
        }
      }

      return Array.from(classChampionsMap.values())
        .sort((a, b) => b.presences - a.presences)
        .slice(0, 3);
    })();

    const highlights = await prisma.quarterHighlight.findMany({
      where: highlightWhere,
      include: {
        student: { select: { name: true, photo: true } },
        class: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 2,
    });

    const destaque = highlights.find((h) => h.type === "destaque");
    const missionario = highlights.find((h) => h.type === "missionario");

    // Fetch Avisos from Calendar (Events of type 'aviso')
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    const avisosCalendario = await prisma.event.findMany({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        type: "aviso",
      },
      orderBy: { date: "asc" },
      take: 5,
    });

    // Fetch recent visitors (current month)
    const visitorsWhere: any = {
      date: { gte: startOfMonth, lte: endOfMonth },
    };
    if (allowedClassIds) {
      visitorsWhere.classId = { in: allowedClassIds };
    }

    const recentVisitors = await prisma.visitor.findMany({
      where: visitorsWhere,
      include: {
        class: { select: { name: true } },
        invitedBy: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 10,
    });

    const totalVisitors = await prisma.visitor.count({
      where: visitorsWhere,
    });

    return NextResponse.json({
      stats: {
        totalStudents,
        activeStudents,
        totalClasses,
        totalLeaders: userRole === "ADMIN" ? totalLeaders : 0,
        presentes,
        faltas,
        justificadas,
        aniversariantes: aniversariantesDoMes.length,
        totalVisitors,
      },
      aniversariantesDoMes: aniversariantesDoMes
        .sort((a, b) => {
          const dayA = a.birthDate!.getUTCDate();
          const dayB = b.birthDate!.getUTCDate();
          return dayA - dayB;
        })
        .slice(0, 8),
      recentVisitors: recentVisitors.map(v => ({
        id: v.id,
        name: v.name,
        date: v.date,
        className: v.class?.name,
        invitedByName: v.invitedBy?.name || null,
        observations: v.observations,
      })),
      avisosCalendario: avisosCalendario.map(a => ({
        id: a.id,
        title: a.title,
        date: a.date,
        description: a.description,
      })),
      attendanceByClass,
      weeklyData,
      pizzaData: [
        { name: "Presentes", value: presentes, color: "#10b981" },
        { name: "Faltas", value: faltas, color: "#ef4444" },
        { name: "Justificadas", value: justificadas, color: "#f59e0b" },
      ],
      destaque: destaque
        ? { 
            nome: destaque.student.name, 
            classe: destaque.class.name, 
            motivo: destaque.reason,
            foto: destaque.photo || destaque.student.photo 
          }
        : null,
      missionario: missionario
        ? { 
            nome: missionario.student.name, 
            classe: missionario.class.name, 
            motivo: missionario.reason,
            foto: missionario.photo || missionario.student.photo 
          }
        : null,
      ranking,
      currentQuarter: selectedQuarter,
    });
  } catch (error) {
    console.error("Erro no dashboard:", error);
    return NextResponse.json({ error: "Erro ao carregar dashboard" }, { status: 500 });
  }
}
