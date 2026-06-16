import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Token do Vercel Blob
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "vercel_blob_rw_12Z3rqWooPyc8G9Q_QvILDyvVrVA0gqpZJAmg0V6eR2qg8A";

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

    // 2. Ler o arquivo do FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (e) {
      return NextResponse.json(
        { error: "Não foi possível processar o arquivo enviado. Verifique se o arquivo não excede 4MB." },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "Nenhum arquivo válido encontrado no upload" },
        { status: 400 }
      );
    }

    // 3. Validar tamanho (4MB - limite da Vercel serverless)
    const maxSize = 4 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). O limite máximo é 4MB.` },
        { status: 400 }
      );
    }

    // 4. Upload direto para o Vercel Blob via put()
    const blob = await put(file.name, file, {
      access: "public",
      token: BLOB_TOKEN,
      addRandomSuffix: true,
    });

    console.log("[Upload] Sucesso:", blob.url);

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error: any) {
    console.error("[Upload] Erro:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Erro interno no upload" },
      { status: 500 }
    );
  }
}
