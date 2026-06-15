import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// GET - Listar materiais
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const category = searchParams.get("category");

    const where: any = { active: true };

    if (classId && classId !== "Todas") {
      where.classId = classId === "Geral" ? null : classId;
    }
    if (category && category !== "Todas") {
      where.category = category;
    }

    const materials = await prisma.material.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(materials);
  } catch (error) {
    console.error("Erro ao buscar materiais:", error);
    return NextResponse.json({ error: "Erro ao buscar materiais" }, { status: 500 });
  }
}

// POST - Criar material (Apenas ADMIN)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas administradores podem adicionar materiais" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, fileUrl, fileName, fileSize, category, classId } = body;

    if (!title || !fileUrl || !fileName) {
      return NextResponse.json({ error: "Título, arquivo e URL são obrigatórios" }, { status: 400 });
    }

    const material = await prisma.material.create({
      data: {
        title,
        description: description || null,
        fileUrl,
        fileName,
        fileSize: fileSize ? Number(fileSize) : 0,
        category: category || "Outros",
        classId: classId && classId !== "none" ? classId : null,
      },
      include: {
        class: { select: { id: true, name: true } }
      }
    });

    return NextResponse.json(material, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao criar material:", error);
    return NextResponse.json({ error: error.message || "Erro ao criar material" }, { status: 500 });
  }
}
