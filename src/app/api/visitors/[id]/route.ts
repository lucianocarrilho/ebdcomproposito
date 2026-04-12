import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// PUT - Editar visitante (somente ADMIN)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas administradores podem editar visitantes" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, date, classId, invitedById, observations } = body;

    const visitor = await prisma.visitor.update({
      where: { id },
      data: {
        name,
        date: date ? new Date(date + "T12:00:00") : undefined,
        classId,
        invitedById: (!invitedById || invitedById === "none") ? null : invitedById,
        observations,
      },
      include: { class: true, invitedBy: true },
    });

    return NextResponse.json(visitor);
  } catch (error: any) {
    console.error("Erro ao editar visitante:", error);
    return NextResponse.json({ error: error.message || "Erro ao editar visitante" }, { status: 500 });
  }
}

// DELETE - Excluir visitante (somente ADMIN)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas administradores podem excluir visitantes" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.visitor.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao excluir visitante:", error);
    return NextResponse.json({ error: error.message || "Erro ao excluir visitante" }, { status: 500 });
  }
}
