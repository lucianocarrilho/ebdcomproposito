import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Listar líderes e usuários com cargos de liderança/professor
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get("role");

    // 1. Buscar da tabela de Líderes (manual)
    const leaderWhere: any = { active: true };
    if (roleParam && roleParam !== "Todos") leaderWhere.role = roleParam;

    const manualLeaders = await prisma.leader.findMany({
      where: leaderWhere,
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });

    // 2. Buscar da tabela de Usuários (Gestão de Acesso)
    // Somente se não estivermos filtrando por algo que não seja professor/admin
    const users = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "PROFESSOR"] },
        active: true,
      },
      select: { id: true, name: true, role: true },
    });

    // Converter cargos de User para o formato de Leader
    const userLeaders = users.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role === "PROFESSOR" ? "PROFESSOR" : "DIRIGENTE",
    }));

    // 3. Juntar e remover duplicados pelo nome
    const combined = [...manualLeaders, ...userLeaders];
    
    // Usar Map para garantir nomes únicos (preferindo o da tabela User se houver conflito)
    const uniqueMap = new Map();
    combined.forEach(l => {
      // Se já existe e é de Leader, o User sobrescreve (costuma ser mais atualizado)
      if (!uniqueMap.has(l.name.toLowerCase())) {
        uniqueMap.set(l.name.toLowerCase(), l);
      }
    });

    const result = Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro ao buscar líderes:", error);
    return NextResponse.json({ error: "Erro ao buscar líderes" }, { status: 500 });
  }
}

// POST - Criar líder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, role, phone, email, classId, startDate, observations, photo } = body;

    if (!name || !role) {
      return NextResponse.json({ error: "Nome e cargo são obrigatórios" }, { status: 400 });
    }

    const leader = await prisma.leader.create({
      data: {
        name,
        role,
        phone,
        email,
        class: classId && classId !== "none" ? { connect: { id: classId } } : undefined,
        startDate: startDate ? new Date(startDate) : new Date(),
        observations,
        photo,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    return NextResponse.json(leader, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao criar líder:", error);
    return NextResponse.json({ error: error.message || "Erro ao criar líder" }, { status: 500 });
  }
}
