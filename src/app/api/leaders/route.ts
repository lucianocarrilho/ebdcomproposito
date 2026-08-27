import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const orgData = await requireOrganization(true);
    if (!orgData || (orgData as any).error) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
    const { activeOrganizationId, orgRole } = orgData as any;

    const allowedRoles = ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE", "PROFESSOR", "APOIO"];
    if (!allowedRoles.includes(orgRole)) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const activeParam = searchParams.get("active");

    const where: Prisma.LeaderWhereInput = {
      organizationId: activeOrganizationId
    };

    if (activeParam !== null) {
      where.active = activeParam === "true";
    }

    if (search) {
      where.name = { contains: search };
    }

    const leaders = await prisma.leader.findMany({
      where,
      include: { class: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(leaders);
  } catch (error) {
    console.error("Erro ao buscar líderes:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgData = await requireOrganization(true);
    if (!orgData || (orgData as any).error) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
    const { activeOrganizationId, orgRole } = orgData as any;

    if (orgRole !== "ADMIN" && orgRole !== "DIRIGENTE") {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const body = await request.json();

    if ("organizationId" in body) {
      return NextResponse.json({ error: "O campo organizationId não deve ser enviado" }, { status: 400 });
    }

    const { name, role, phone, email, classId, startDate, observations, photo } = body;

    if (!name || !role) {
      return NextResponse.json({ error: "Nome e papel (role) são obrigatórios" }, { status: 400 });
    }

    if (classId && classId !== "none") {
      const classExists = await prisma.class.findFirst({
        where: { id: classId, organizationId: activeOrganizationId }
      });
      if (!classExists) {
        return NextResponse.json({ error: "Classe não encontrada" }, { status: 404 });
      }
    }

    const leader = await prisma.leader.create({
      data: {
        name,
        role,
        phone,
        email,
        classId: classId === "none" ? null : classId,
        startDate: startDate ? new Date(startDate) : new Date(),
        observations,
        photo,
        organizationId: activeOrganizationId,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    return NextResponse.json(leader, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar líder:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
