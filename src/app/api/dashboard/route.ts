import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET - Dashboard statistics
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
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

    const studentWhere = allowedClassIds ? { classId: { in: allowedClassIds } } : {};
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

    const aniversariantesDoMes = aniversariantes.filter((a) => {
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

    // Settings
    const settings = await prisma.settings.findFirst();
    const quarter = settings?.currentQuarter || "2026-Q1";

    // Highlights
    const highlightWhere: any = { quarter };
    if (allowedClassIds) {
      highlightWhere.classId = { in: allowedClassIds };
    }

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
      },
      aniversariantesDoMes: aniversariantesDoMes.slice(0, 5),
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
    });
  } catch (error) {
    console.error("Erro no dashboard:", error);
    return NextResponse.json({ error: "Erro ao carregar dashboard" }, { status: 500 });
  }
}
