import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ROLES = ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE", "PROFESSOR", "APOIO"];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    if (!session || !ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    
    if (!dateStr) {
      return NextResponse.json({ error: "Data não informada" }, { status: 400 });
    }

    // Use consistent UTC date to avoid timezone issues
    const date = new Date(dateStr + "T00:00:00.000Z");

    const attendance = await prisma.leaderAttendance.findMany({
      where: { date }
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error("Erro ao buscar presença da liderança:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    if (!session || !ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { date: dateStr, items } = await request.json();
    
    // Use consistent UTC date
    const date = new Date(dateStr + "T00:00:00.000Z");

    console.log("[LeaderAttendance] Salvando chamada:", {
      date: date.toISOString(),
      itemCount: items?.length,
      userRole,
    });

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Nenhum item de presença enviado" }, { status: 400 });
    }

    // Delete existing records for this date first, then create new ones
    // This avoids upsert unique constraint issues with MySQL datetime comparisons
    await prisma.leaderAttendance.deleteMany({
      where: { date }
    });

    // Create all attendance records
    await prisma.leaderAttendance.createMany({
      data: items.map((item: any) => ({
        leaderId: item.leaderId,
        date,
        status: item.status,
        justification: item.justification || null,
      }))
    });

    console.log("[LeaderAttendance] Chamada salva com sucesso para", date.toISOString());

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao salvar presença da liderança:", error?.message || error);
    console.error("Stack:", error?.stack);
    return NextResponse.json({ 
      error: "Erro ao salvar", 
      details: error?.message || "Erro desconhecido"
    }, { status: 500 });
  }
}
