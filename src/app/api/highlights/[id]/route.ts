import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { studentId, classId, quarter, reason, type } = body;

    const highlight = await prisma.quarterHighlight.update({
      where: { id },
      data: {
        ...(studentId && { studentId }),
        ...(classId && { classId }),
        ...(quarter && { quarter }),
        ...(reason && { reason }),
        ...(type && { type }),
      },
      include: {
        student: { select: { name: true, photo: true } },
        class: { select: { name: true } },
      },
    });

    return NextResponse.json(highlight);
  } catch (error) {
    console.error("Error updating highlight:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar destaque" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.quarterHighlight.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting highlight:", error);
    return NextResponse.json(
      { error: "Erro ao excluir destaque" },
      { status: 500 }
    );
  }
}
