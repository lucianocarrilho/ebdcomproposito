import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Listar lições
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
    const quarter = searchParams.get("quarter") || "2026-Q2";
    const category = searchParams.get("category");

    const where: Record<string, unknown> = { quarter };

    // Enforcement: Professors only see lessons for categories they teach
    if (userRole === "PROFESSOR") {
      const teacherClasses = await prisma.class.findMany({
        where: {
          OR: [
            { id: userClassId || undefined },
            { professor: { contains: userName } }
          ]
        },
        select: { name: true }
      });
      
      const allowedCategories = ["Adultos", "Jovens", "Adolescentes", "Crianças"].filter(cat => 
        teacherClasses.some(cls => cls.name.toLowerCase().includes(cat.toLowerCase().substring(0, 5)))
      );

      if (category) {
        if (!allowedCategories.includes(category)) {
          return NextResponse.json([]); // Return empty if category not allowed
        }
        where.category = category;
      } else {
        where.category = { in: allowedCategories };
      }
    } else if (category) {
      where.category = category;
    }

    const lessons = await prisma.lesson.findMany({
      where,
      orderBy: { number: "asc" },
    });

    return NextResponse.json(lessons);
  } catch (error) {
    console.error("Erro ao buscar lições:", error);
    return NextResponse.json({ error: "Erro ao buscar lições" }, { status: 500 });
  }
}

// POST - Criar lição
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { number, title, quarter, category, date, summary, bibleText, status, image } = body;

    if (!title || !number) {
      return NextResponse.json({ error: "Título e número são obrigatórios" }, { status: 400 });
    }

    const lesson = await prisma.lesson.create({
      data: {
        number: Number(number),
        title,
        quarter: quarter || "2026-Q2",
        category: category || "Adultos",
        date: date ? new Date(date) : null,
        summary,
        bibleText,
        image,
        status: status || "pendente",
      },
    });

    return NextResponse.json(lesson, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao criar lição:", error);
    return NextResponse.json({ error: error.message || "Erro ao criar lição" }, { status: 500 });
  }
}
