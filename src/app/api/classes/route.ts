import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Listar classes
export async function GET(request: NextRequest) {
  try {
    const classes = await prisma.class.findMany({
      include: {
        students: {
          where: { active: true },
          select: { id: true },
        },
        leaders: {
          where: { active: true },
          select: { name: true, role: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const formatted = classes.map((cls) => ({
      ...cls,
      active: cls.status,
      studentCount: cls.students.length,
      // Usar campos diretos da classe, se existirem, ou o primeiro líder com esse cargo como backup
      professor: cls.professor || cls.leaders.find((l) => l.role === "Professor")?.name || "",
      dirigente: cls.dirigente || cls.leaders.find((l) => l.role === "Dirigente")?.name || "",
      viceDirigente: cls.viceDirigente || cls.leaders.find((l) => l.role === "Vice-Dirigente")?.name || "",
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Erro ao buscar classes:", error);
    return NextResponse.json({ error: "Erro ao buscar classes" }, { status: 500 });
  }
}

// POST - Criar classe
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, audience, active, professor, dirigente, viceDirigente } = body;

    if (!name) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const newClass = await prisma.class.create({
      data: { 
        name, 
        description, 
        audience, 
        professor,
        dirigente,
        viceDirigente,
        status: active !== undefined ? active : true 
      },
    });

    return NextResponse.json(newClass, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar classe:", error);
    return NextResponse.json({ error: "Erro ao criar classe" }, { status: 500 });
  }
}
