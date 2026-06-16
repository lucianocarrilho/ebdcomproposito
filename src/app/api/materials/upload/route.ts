import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Token do Vercel Blob
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "vercel_blob_rw_12Z3rqWooPyc8G9Q_QvILDyvVrVA0gqpZJAmg0V6eR2qg8A";

export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch (parseError) {
    console.error("[Upload Route] Erro ao parsear body:", parseError);
    return NextResponse.json(
      { error: "Requisição inválida - corpo da requisição não é JSON válido" },
      { status: 400 }
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: BLOB_TOKEN,
      onBeforeGenerateToken: async (pathname) => {
        // Verificar autenticação
        const session = await auth();
        if (!session || (session.user as any)?.role !== "ADMIN") {
          throw new Error("Apenas administradores podem fazer upload de arquivos");
        }

        return {
          allowedContentTypes: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/zip",
            "application/x-rar-compressed",
            "application/epub+zip",
            "text/plain",
            "application/octet-stream",
          ],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            userId: (session.user as any).id,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Callback chamado pelo Vercel após o upload ser concluído
        console.log("[Upload Route] Upload concluído:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error("[Upload Route] Erro:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Erro no processamento do upload" },
      { status: 400 }
    );
  }
}
