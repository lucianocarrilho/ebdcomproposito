import { NextResponse } from 'next/server';

export async function GET() {
  const token = "vercel_blob_rw_12Z3rqWooPyc8G9Q_QvILDyvVrVA0gqpZJAmg0V6eR2qg8A";
  const baseUrl = "https://12z3rqwoopyc8g9q.public.blob.vercel-storage.com";
  
  return NextResponse.json({ token, baseUrl });
}
