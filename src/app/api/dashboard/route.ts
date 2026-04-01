import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { AttendanceStatus } from "@prisma/client";

// GET - Dashboard statistics
export async function GET() {
  try {
    // Totals
    const [
      totalStudents,
      activeStudents,
      totalClasses,
      totalLeaders,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { active: true } }),
      prisma.class.count({ where: { status: true } }),
      prisma.leader.count({ where: { active: true } }),
    ]);

    // Last Sunday attendance
    const today = new Date();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - today.getDay());
    lastSunday.setHours(0, 0, 0, 0);

    const lastAttendance = await prisma.attendanceItem.groupBy({
      by: ["status"],
      _count: { id: true },
      where: {
        record: { date: { gte: lastSunday } },
      },
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
      return a.birthDate.getMonth() + 1 === currentMonth;
    });

    // Attendance by class
    const classes = await prisma.class.findMany({
      where: { status: true },
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

      const items = await prisma.attendanceItem.groupBy({
        by: ["status"],
        _count: { id: true },
        where: {
          record: { date: { gte: weekStart, lt: weekEnd } },
        },
      });

      const getWkStatusCount = (status: AttendanceStatus) => 
        items.find((i) => i.status === status)?._count.id || 0;

      weeklyData.push({
        semana: `Sem ${5 - w}`,
        presenca: getWkStatusCount("PRESENTE"),
        faltas: getWkStatusCount("FALTA"),
      });
    }

    // Top students by frequency
    const settings = await prisma.settings.findFirst();
    const quarter = settings?.currentQuarter || "2026-Q1";

    // Highlights
    const highlights = await prisma.quarterHighlight.findMany({
      where: { quarter },
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
        totalLeaders,
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
