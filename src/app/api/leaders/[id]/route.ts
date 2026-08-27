import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgData = await requireOrganization(true);
    if (!orgData || (orgData as any).error) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
    const { activeOrganizationId, orgRole } = orgData as any;

    const allowedRoles = ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE", "PROFESSOR", "APOIO"];
    if (!allowedRoles.includes(orgRole)) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const leader = await prisma.leader.findFirst({
      where: { id: id, organizationId: activeOrganizationId },
      include: {
        class: { select: { id: true, name: true } },
      },
    });

    if (!leader) {
      return NextResponse.json({ error: "Líder não encontrado" }, { status: 404 });
    }

    return NextResponse.json(leader);
  } catch (error) {
    console.error("Erro ao buscar líder:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      return NextResponse.json({ error: "O campo organizationId não pode ser alterado" }, { status: 400 });
    }

    const existing = await prisma.leader.findFirst({
      where: { id: id, organizationId: activeOrganizationId }
    });
    if (!existing) {
      return NextResponse.json({ error: "Líder não encontrado" }, { status: 404 });
    }

    if (body.classId && body.classId !== "none" && body.classId !== existing.classId) {
      const classExists = await prisma.class.findFirst({
        where: { id: body.classId, organizationId: activeOrganizationId }
      });
      if (!classExists) {
        return NextResponse.json({ error: "Nova classe não encontrada" }, { status: 404 });
      }
    }

    const { name, role, phone, email, classId, active, startDate, observations, photo } = body;

    const leader = await prisma.leader.update({
      where: { id: id, organizationId: activeOrganizationId },
      data: {
        name,
        role,
        phone,
        email,
        classId: classId === "none" ? null : classId,
        active,
        startDate: startDate ? new Date(startDate) : undefined,
        observations,
        photo,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    return NextResponse.json(leader);
  } catch (error) {
    console.error("Erro ao atualizar líder:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgData = await requireOrganization(true);
    if (!orgData || (orgData as any).error) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
    const { activeOrganizationId, orgRole } = orgData as any;

    if (orgRole !== "ADMIN" && orgRole !== "DIRIGENTE") {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const existing = await prisma.leader.findFirst({
      where: { id: id, organizationId: activeOrganizationId }
    });
    if (!existing) {
      return NextResponse.json({ error: "Líder não encontrado" }, { status: 404 });
    }

    await prisma.leader.delete({
      where: { id: id, organizationId: activeOrganizationId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir líder:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
