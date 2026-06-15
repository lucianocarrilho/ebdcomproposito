import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const session = await auth();
    // Restringir a geração de tokens de upload apenas para administradores
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas administradores podem fazer upload" }, { status: 403 });
    }

    const blobToken = "vercel_blob_rw_12Z3rqWooPyc8G9Q_QvILDyvVrVA0gqpZJAmg0V6eR2qg8A";

    const jsonResponse = await handleUpload({
      body,
      request,
      token: blobToken,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Retorna a autorização e as opções do token
        return {
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            userId: (session.user as any).id,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Callback executado pela Vercel após o término do upload.
        // Como atualizamos o banco de dados diretamente no formulário do cliente, não precisamos fazer nada aqui.
        console.log("Upload concluído no Vercel Blob:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error("[API Materials Upload] Erro ao gerar token:", error);
    return NextResponse.json({ error: error.message || "Erro no upload" }, { status: 400 });
  }
}
