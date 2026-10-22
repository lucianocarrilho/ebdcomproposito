import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { extractUserRole } from "@/lib/upload-security";

// DELETE - Excluir material (Apenas ADMIN)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const userRole = extractUserRole(session);
    if (userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Apenas administradores podem excluir materiais" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Buscar o material para obter a URL do arquivo
    const material = await prisma.material.findUnique({
      where: { id },
    });

    if (!material) {
      return NextResponse.json({ error: "Material não encontrado" }, { status: 404 });
    }

    // Excluir do Banco de Dados
    await prisma.material.delete({
      where: { id },
    });

    // Excluir do Vercel Blob se for uma URL remota (sem token manual)
    if (material.fileUrl && material.fileUrl.includes("blob.vercel-storage.com")) {
      try {
        await del(material.fileUrl);
      } catch {
        // Falha no blob não impede a remoção cadastral, mas é sanitizada para evitar vazamento
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Erro ao excluir material" },
      { status: 500 }
    );
  }
}
