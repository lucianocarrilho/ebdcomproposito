import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';

export async function POST(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');

  if (!filename) {
    return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
  }

  // Se o token estiver configurado, use o Vercel Blob (Produção)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(filename, request.body!, {
        access: 'public',
      });
      return NextResponse.json(blob);
    } catch (error) {
      console.error('Vercel Blob upload error:', error);
      // Fallback para local se o blob falhar por algum motivo de config
    }
  }

  // Fallback: Salvar localmente (Desenvolvimento)
  try {
    const bytes = await request.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Gerar nome único para evitar colisões
    const uniqueFilename = `${Date.now()}-${filename.replace(/\s+/g, '-')}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    
    // Garantir que a pasta existe
    if (!fs.existsSync(uploadDir)) {
      await fs.promises.mkdir(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, uniqueFilename);
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${uniqueFilename}`;
    
    console.log(`Local upload success: ${publicUrl}`);
    
    return NextResponse.json({ 
      url: publicUrl,
      downloadUrl: publicUrl,
      pathname: uniqueFilename,
      size: buffer.length
    });
  } catch (error) {
    console.error('Local upload error:', error);
    return NextResponse.json({ error: 'Failed to upload locally' }, { status: 500 });
  }
}
