import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const baseUrl = process.env.BLOB_BASE_URL || '';
  
  if (!token || !baseUrl) {
    // Retornamos 200 mas sem credenciais para o frontend saber que deve usar o fallback
    return NextResponse.json({ token: null, baseUrl: null });
  }
  
  return NextResponse.json({ token, baseUrl });
}
