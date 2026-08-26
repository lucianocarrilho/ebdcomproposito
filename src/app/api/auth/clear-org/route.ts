import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const user = session.user as any;

    if (!user.isGlobalAdmin) {
      return NextResponse.json({ error: "Apenas administradores globais podem acessar o painel sistêmico livremente" }, { status: 403 });
    }

    // Validation successful! The client can now call update({ activeOrganizationId: null })
    return NextResponse.json({ success: true, message: "Validação concluída para limpar contexto" });

  } catch (error) {
    console.error("Erro ao validar limpeza de contexto:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
