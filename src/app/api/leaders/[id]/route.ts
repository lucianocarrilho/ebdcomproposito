import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PUT - Atualizar líder
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await prisma.leader.upsert({
      where: { id },
      update: {
        name: body.name,
        role: body.role,
        phone: body.phone,
        email: body.email,
        class: body.classId && body.classId !== "none" ? { connect: { id: body.classId } } : { disconnect: true },
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        observations: body.observations,
        photo: body.photo,
      },
      create: {
        id,
        name: body.name,
        role: body.role,
        phone: body.phone,
        email: body.email,
        class: body.classId && body.classId !== "none" ? { connect: { id: body.classId } } : undefined,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        observations: body.observations,
        photo: body.photo,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar líder:", error);
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

// DELETE
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.leader.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir líder:", error);
    return NextResponse.json({ error: "Erro ao excluir" }, { status: 500 });
  }
}
