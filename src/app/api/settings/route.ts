import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Buscar configurações
export async function GET() {
  try {
    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          churchName: "Igreja",
          currentQuarter: "2026-Q1",
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PUT - Atualizar configurações
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { churchName, logo, currentQuarter } = body;

    let settings = await prisma.settings.findFirst();

    if (settings) {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: { churchName, logo, currentQuarter },
      });
    } else {
      settings = await prisma.settings.create({
        data: { churchName, logo, currentQuarter },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Erro ao salvar configurações:", error);
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
  }
}
