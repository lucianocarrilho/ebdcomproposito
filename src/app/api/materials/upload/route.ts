import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Token do Vercel Blob
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "vercel_blob_rw_12Z3rqWooPyc8G9Q_QvILDyvVrVA0gqpZJAmg0V6eR2qg8A";

// Permitir body maior para upload de arquivos (até 50MB)
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // 1. Verificar autenticação
    const session = await auth();
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Apenas administradores podem fazer upload de arquivos" },
        { status: 403 }
      );
    }

    // 2. Ler FormData do request
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo encontrado no upload" },
        { status: 400 }
      );
    }

    // 3. Validar tamanho (50MB máximo)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(2)}MB). Limite: 50MB` },
        { status: 400 }
      );
    }

    // 4. Upload para Vercel Blob
    const blob = await put(file.name, file, {
      access: "public",
      token: BLOB_TOKEN,
      addRandomSuffix: true,
    });

    console.log("[Upload Route] Upload concluído com sucesso:", blob.url);

    // 5. Retornar dados do blob
    return NextResponse.json({
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      contentType: blob.contentType,
    });
  } catch (error: any) {
    console.error("[Upload Route] Erro no upload:", error);
    return NextResponse.json(
      { error: error.message || "Erro desconhecido no upload" },
      { status: 500 }
    );
  }
}
