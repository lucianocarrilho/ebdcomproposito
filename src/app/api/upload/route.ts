import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';
// Configuração opcional: Se estiver na Vercel, o disk write vai falhar.
// Usamos apenas Vercel Blob em produção.

export async function POST(request: Request): Promise<NextResponse> {
  console.log("[API Upload] --- INÍCIO DA REQUISIÇÃO ---");
  
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      console.error("[API Upload] Erro: Nome do arquivo ausente");
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    // Leitura do corpo como ArrayBuffer para uso binário puro
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[API Upload] Arquivo: ${filename}, Tamanho: ${buffer.length} bytes`);

    // 1. Tentar Vercel Blob (Produção)
    const blobToken = "vercel_blob_rw_12Z3rqWooPyc8G9Q_QvILDyvVrVA0gqpZJAmg0V6eR2qg8A";
    
    try {
      console.log(`[API Upload] Tentando Vercel Blob para ${filename}`);
      const blob = await put(filename, buffer, {
        access: 'public',
        token: blobToken
      });
      console.log(`[API Upload] Vercel Blob sucesso: ${blob.url}`);
      return NextResponse.json(blob);
    } catch (blobError: any) {
      console.error('[API Upload] Falha no Vercel Blob:', blobError.message || blobError);
      // Segue para o fallback local apenas se em desenvolvimento
    }

    // 2. Fallback: Salvar localmente (SOMENTE EM DESENVOLVIMENTO)
    if (process.env.NODE_ENV === 'development') {
      try {
        const uniqueFilename = `${Date.now()}-${filename.replace(/\s+/g, '-')}`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        
        if (!fs.existsSync(uploadDir)) {
          await fs.promises.mkdir(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, uniqueFilename);
        await writeFile(filePath, buffer);

        const publicUrl = `/uploads/${uniqueFilename}`;
        return NextResponse.json({ url: publicUrl });
      } catch (localError: any) {
        console.error('[API Upload] Erro no upload local:', localError);
      }
    }

    // Se chegou aqui em produção sem Blob, é um erro de configuração
    return NextResponse.json({ 
      error: 'Armazenamento não configurado. Por favor, ative o Vercel Blob no dashboard.' 
    }, { status: 501 });

  } catch (error: any) {
    console.error('[API Upload] ERRO CRÍTICO:', error);
    // Retornamos um JSON com detalhes para o frontend
    return new NextResponse(JSON.stringify({ 
      error: 'Erro interno no servidor ao processar imagem', 
      details: error.message || 'Erro sem mensagem',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
