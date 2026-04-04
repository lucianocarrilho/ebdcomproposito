import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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
    const monthStr = searchParams.get("month");
    const currentMonth = monthStr ? parseInt(monthStr) : new Date().getMonth() + 1;

    // Build the query to find students with birthday in the selected month
    // Prisma doesn't have a direct "month" filter for DateTime in all adapters, 
    // but for MySQL we can use raw query or findMany with filtering.
    // For universal compatibility, we'll fetch students and filter in JS if needed,
    // but better to use a where filter if classId is present.

    const where: any = {
      active: true,
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
      where.classId = { in: classIds };
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        class: { select: { name: true } }
      }
    });

    // Filter by birth month in JS to be DB-agnostic
    const birthdays = students.filter(s => {
      if (!s.birthDate) return false;
      return new Date(s.birthDate).getUTCMonth() + 1 === currentMonth;
    }).map(s => {
      const birth = new Date(s.birthDate!);
      const today = new Date();
      let age = today.getFullYear() - birth.getUTCFullYear();
      
      // Basic age calculation
      const m = today.getMonth() - birth.getUTCMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getUTCDate())) {
        age--;
      }

      return {
        id: s.id,
        nome: s.name,
        nascimento: `${String(birth.getUTCDate()).padStart(2, '0')}/${String(birth.getUTCMonth() + 1).padStart(2, '0')}`,
        classe: s.class.name,
        idade: age,
        photo: s.photo,
        dia: birth.getUTCDate()
      };
    }).sort((a, b) => a.dia - b.dia);

    return NextResponse.json(birthdays);
  } catch (error) {
    console.error("Erro ao buscar aniversariantes:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
