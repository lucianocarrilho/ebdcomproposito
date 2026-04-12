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

    const body = await request.json();
    const { date: dateStr, items } = body;

    console.log("[LeaderAttendance] Raw body:", JSON.stringify(body));

    if (!dateStr) {
      return NextResponse.json({ error: "Data não informada" }, { status: 400 });
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Nenhum item de presença enviado" }, { status: 400 });
    }

    // Validate date format
    const date = new Date(dateStr + "T00:00:00.000Z");
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: `Data inválida: ${dateStr}` }, { status: 400 });
    }

    console.log("[LeaderAttendance] Saving attendance:", {
      date: date.toISOString(),
      itemCount: items.length,
      userRole,
      sampleItem: items[0],
    });

    // Validate all leaderIds exist
    const leaderIds = items.map((item: any) => item.leaderId).filter(Boolean);
    const existingLeaders = await prisma.leader.findMany({
      where: { id: { in: leaderIds } },
      select: { id: true }
    });
    const existingIds = new Set(existingLeaders.map(l => l.id));
    const invalidIds = leaderIds.filter((id: string) => !existingIds.has(id));
    
    if (invalidIds.length > 0) {
      console.log("[LeaderAttendance] Invalid leader IDs:", invalidIds);
    }

    // Filter to only valid items
    const validItems = items.filter((item: any) => 
      item.leaderId && existingIds.has(item.leaderId) && item.status
    );

    if (validItems.length === 0) {
      return NextResponse.json({ error: "Nenhum líder válido encontrado" }, { status: 400 });
    }

    // Delete existing records for this date first, then create new ones
    // This avoids upsert issues with MySQL datetime comparisons
    await prisma.leaderAttendance.deleteMany({
      where: { date }
    });

    // Create all attendance records
    await prisma.leaderAttendance.createMany({
      data: validItems.map((item: any) => ({
        leaderId: item.leaderId,
        date,
        status: item.status,
        justification: item.justification || null,
      }))
    });

    console.log("[LeaderAttendance] Success! Saved", validItems.length, "records for", date.toISOString());

    return NextResponse.json({ success: true, saved: validItems.length });
  } catch (error: any) {
    console.error("[LeaderAttendance] ERROR:", error?.message || error);
    console.error("[LeaderAttendance] Stack:", error?.stack);
    return NextResponse.json({ 
      error: "Erro ao salvar chamada",
      details: error?.message || "Erro desconhecido"
    }, { status: 500 });
  }
}
