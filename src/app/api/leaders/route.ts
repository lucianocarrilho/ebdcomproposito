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
      include: { class: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
 
    // 2. Buscar da tabela de Usuários (Gestão de Acesso)
    const users = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "PROFESSOR"] },
        active: true,
      },
      select: { id: true, name: true, role: true, email: true, image: true },
    });
 
    // 3. Identificar usuários que NÃO existem ainda na tabela Leaders (por nome E por e-mail)
    const existingLeaderNames = new Set(manualLeaders.map(l => l.name.toLowerCase()));
    const existingLeaderEmails = new Set(
      manualLeaders.map(l => l.email?.toLowerCase()).filter(Boolean)
    );

    const missingUsers = users.filter(u => {
      const nameMatch = existingLeaderNames.has(u.name.toLowerCase());
      const emailMatch = u.email ? existingLeaderEmails.has(u.email.toLowerCase()) : false;
      return !nameMatch && !emailMatch;
    });

    // 4. Auto-criar registros na tabela Leaders para usuários que faltam
    // Isso garante que a chamada de presença funcione corretamente (foreign key)
    if (missingUsers.length > 0) {
      console.log("[Leaders] Auto-criando líderes para usuários:", missingUsers.map(u => u.name));
      
      for (const u of missingUsers) {
        try {
          const newLeader = await prisma.leader.create({
            data: {
              name: u.name,
              role: u.role === "PROFESSOR" ? "Professor" : "Dirigente",
              email: u.email,
              photo: u.image,
              active: true,
            },
          });
          // Adicionar o novo líder à lista
          manualLeaders.push(newLeader as any);
        } catch (err: any) {
          console.error(`[Leaders] Erro ao auto-criar líder para ${u.name}:`, err?.message);
        }
      }
    }

    // 5. Juntar e remover duplicados pelo nome
    const combined = [...manualLeaders];
    
    // Adicionar users que já existem como leaders (não duplicar)
    // Mas precisamos garantir que usamos o ID da tabela leaders
    const uniqueMap = new Map();
    combined.forEach(l => {
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
