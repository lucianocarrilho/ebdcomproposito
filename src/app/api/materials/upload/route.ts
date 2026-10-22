import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  extractUserRole,
  validateMaterialUpload,
  generateSafeBlobPath,
} from "@/lib/upload-security";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // 1. Verificar autenticação
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    // 2. Autorização estrita: apenas ADMIN pode enviar materiais didáticos
    const userRole = extractUserRole(session);
    if (userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Apenas administradores podem fazer upload de materiais" },
        { status: 403 }
      );
    }

    // 3. Ler o arquivo do FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Não foi possível processar o arquivo enviado. Verifique se o arquivo não excede 4MB." },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    if (!file || typeof file === "string" || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Nenhum arquivo válido encontrado no upload" },
        { status: 400 }
      );
    }

    // 4. Converter arquivo para buffer e validar
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validation = validateMaterialUpload(file.name, buffer, file.type);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const { sanitizedBaseName, contentType } = validation;
    const blobPathname = generateSafeBlobPath("materials", sanitizedBaseName);

    // 5. Upload direto para o Vercel Blob (sem token manual)
    const blob = await put(blobPathname, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro interno no processamento do material" },
      { status: 500 }
    );
  }
}
