import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";

// DELETE - Excluir material (Apenas ADMIN)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas administradores podem excluir materiais" }, { status: 403 });
    }

    const { id } = await params;

    // Buscar o material para obter a URL do arquivo
    const material = await prisma.material.findUnique({
      where: { id }
    });

    if (!material) {
      return NextResponse.json({ error: "Material não encontrado" }, { status: 404 });
    }

    // Excluir do Banco de Dados
    await prisma.material.delete({
      where: { id }
    });

    // Excluir do Vercel Blob se for uma URL remota
    const blobToken = "vercel_blob_rw_12Z3rqWooPyc8G9Q_QvILDyvVrVA0gqpZJAmg0V6eR2qg8A";
    if (material.fileUrl && material.fileUrl.includes("blob.vercel-storage.com")) {
      try {
        console.log(`[API Materials Delete] Tentando excluir do Vercel Blob: ${material.fileUrl}`);
        await del(material.fileUrl, { token: blobToken });
        console.log(`[API Materials Delete] Sucesso ao excluir do Vercel Blob`);
      } catch (blobError) {
        console.error("[API Materials Delete] Erro ao excluir do Vercel Blob:", blobError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao excluir material:", error);
    return NextResponse.json({ error: error.message || "Erro ao excluir material" }, { status: 500 });
  }
}
