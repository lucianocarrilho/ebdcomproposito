import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PUT
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await prisma.lesson.update({
      where: { id },
      data: {
        number: body.number ? Number(body.number) : undefined,
        title: body.title,
        quarter: body.quarter,
        category: body.category,
        date: body.date ? new Date(body.date) : undefined,
        summary: body.summary,
        bibleText: body.bibleText,
        image: body.image,
        status: body.status,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Erro ao atualizar lição:", error);
    return NextResponse.json({ error: error.message || "Erro ao atualizar" }, { status: 500 });
  }
}

// DELETE
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.lesson.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir lição:", error);
    return NextResponse.json({ error: "Erro ao excluir" }, { status: 500 });
  }
}
