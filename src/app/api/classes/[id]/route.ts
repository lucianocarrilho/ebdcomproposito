import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Buscar classe por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        students: { where: { active: true }, orderBy: { name: "asc" } },
        leaders: { where: { active: true } },
        _count: { select: { students: true } },
      },
    });

    if (!cls) {
      return NextResponse.json({ error: "Classe não encontrada" }, { status: 404 });
    }

    return NextResponse.json(cls);
  } catch (error) {
    console.error("Erro ao buscar classe:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PUT - Atualizar classe
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, audience, status } = body;

    const updated = await prisma.class.update({
      where: { id },
      data: { name, description, audience, status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar classe:", error);
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

// DELETE - Excluir classe
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check students
    const count = await prisma.student.count({ where: { classId: id } });
    if (count > 0) {
      return NextResponse.json(
        { error: "Não é possível excluir uma classe com alunos" },
        { status: 400 }
      );
    }

    await prisma.class.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir classe:", error);
    return NextResponse.json({ error: "Erro ao excluir" }, { status: 500 });
  }
}
