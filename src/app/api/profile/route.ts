import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";

export async function GET() {
  try {
    const authResult = await requireAuth(true);
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const userId = authResult.user?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        active: true,
      },
    });

    if (!currentUser || !currentUser.active) {
      return NextResponse.json({ error: "Usuário inativo" }, { status: 401 });
    }

    return NextResponse.json({
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      image: currentUser.image,
    });
  } catch (error) {
    console.error("[API Profile GET] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao carregar perfil" },
      { status: 500 }
    );
  }
}
