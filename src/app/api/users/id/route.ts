import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// PUT - Atualizar usuário
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, role, password } = body;

    const data: any = { name, email, role };
    if (password && password.trim() !== "") {
      data.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

// DELETE - Desativar usuário (Soft Delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Não permitir deletar o próprio usuário ou o admin padrão (opcional, mas seguro)
    // Aqui fazemos apenas o soft delete por consistência
    await prisma.user.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao desativar usuário:", error);
    return NextResponse.json({ error: "Erro ao desativar" }, { status: 500 });
  }
}
