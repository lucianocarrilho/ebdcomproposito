import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';
import { auth } from '@/lib/auth';
import {
  extractUserRole,
  ALLOWED_IMAGE_ROLES,
  validateImageUpload,
  generateSafeBlobPath,
  getSafeLocalPath,
} from '@/lib/upload-security';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // 1. Autenticação estrita no servidor
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Autorização estrita por papel (Role) da produção mono-tenant
    const userRole = extractUserRole(session);
    if (!userRole || !ALLOWED_IMAGE_ROLES.includes(userRole)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // 3. Validação prévia de Content-Length
    const contentLength = request.headers.get('content-length');
    const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4 MiB
    if (contentLength !== null) {
      const trimmedLength = contentLength.trim();
      const parsedLength = parseInt(trimmedLength, 10);
      if (!/^\d+$/.test(trimmedLength) || isNaN(parsedLength) || parsedLength < 0) {
        return NextResponse.json(
          { error: 'Cabeçalho Content-Length inválido' },
          { status: 400 }
        );
      }
      if (parsedLength > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { error: 'Arquivo excede o tamanho máximo de 4MB' },
          { status: 413 }
        );
      }
    }

    // 4. Extração e sanitização do nome do arquivo
    const { searchParams } = new URL(request.url);
    const rawFilename = searchParams.get('filename');
    if (!rawFilename || !rawFilename.trim()) {
      return NextResponse.json({ error: 'Nome do arquivo é obrigatório' }, { status: 400 });
    }

    // 5. Leitura do corpo binário
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 6. Validação rigorosa de extensão, MIME e Magic Bytes
    const declaredMime = request.headers.get('content-type');
    const validation = validateImageUpload(rawFilename, buffer, declaredMime);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { contentType, sanitizedBaseName } = validation;
    const blobPathname = generateSafeBlobPath('images', sanitizedBaseName);

    // 7. Envio para Vercel Blob (sem token manual)
    try {
      const blob = await put(blobPathname, buffer, {
        access: 'public',
        contentType,
        addRandomSuffix: true,
      });

      return NextResponse.json({ url: blob.url });
    } catch {
      // Se não estiver em ambiente de desenvolvimento, sanitiza o erro
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json(
          { error: 'Falha ao processar armazenamento no Vercel Blob' },
          { status: 500 }
        );
      }
    }

    // 8. Fallback local em ambiente de desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      try {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
          await fs.promises.mkdir(uploadDir, { recursive: true });
        }

        const safeFilePath = getSafeLocalPath(uploadDir, sanitizedBaseName);
        if (!safeFilePath) {
          return NextResponse.json({ error: 'Caminho de arquivo inválido' }, { status: 400 });
        }

        await writeFile(safeFilePath, buffer);
        const uniqueFilename = path.basename(safeFilePath);
        const publicUrl = `/uploads/${uniqueFilename}`;

        return NextResponse.json({ url: publicUrl });
      } catch {
        return NextResponse.json(
          { error: 'Falha ao salvar arquivo localmente' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Armazenamento não configurado' },
      { status: 501 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Erro interno ao processar upload' },
      { status: 500 }
    );
  }
}
