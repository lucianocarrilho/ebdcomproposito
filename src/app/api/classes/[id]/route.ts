import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// GET - Buscar classe por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const role = (session.user as any).role;
    const userClassId = (session.user as any).classId;

    if (role === "PROFESSOR" && userClassId !== id) {
      return NextResponse.json({ error: "Acesso negado a esta classe" }, { status: 403 });
    }

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
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    const { name, description, audience, active, status, professor, dirigente, viceDirigente } = body;
    // Use active from frontend or status from body, fallback to current status
    const updatedStatus = active !== undefined ? active : status;

    const updated = await prisma.class.update({
      where: { id },
      data: { 
        name, 
        description, 
        audience, 
        professor,
        dirigente,
        viceDirigente,
        status: updatedStatus 
      },
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
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }
    const { id } = await params;

    // Soft delete check: only block if there are ACTIVE students? 
    // For now, let's allow deletion if the user is sure, or at least fix the logic.
    // If we want to allow deletion even with students, we'd need to handle references.
    // Let's stick to the current safety but ensure the ID is correct.
    const count = await prisma.student.count({ where: { classId: id } });
    if (count > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir uma classe que possui ${count} aluno(s) vinculado(s).` },
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
