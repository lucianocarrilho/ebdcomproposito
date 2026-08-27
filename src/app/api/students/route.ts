import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

// GET - Listar alunos
export async function GET(request: NextRequest) {
  try {
    const orgData = await requireOrganization(true);
    if (!orgData || (orgData as any).error) {
      return NextResponse.json({ error: "Não autorizado ou organização não selecionada" }, { status: 403 });
    }
    const { activeOrganizationId, orgRole } = orgData as any;

    const allowedRoles = ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE", "PROFESSOR", "APOIO"];
    if (!allowedRoles.includes(orgRole)) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const queryClassId = searchParams.get("classId");
    const search = searchParams.get("search");
    const includeInactive = searchParams.get("includeInactive") === "true";
    const activeParam = searchParams.get("active");

    const where: Prisma.StudentWhereInput = {
      organizationId: activeOrganizationId
    };

    if (queryClassId) {
      where.classId = queryClassId;
    }

    if (!includeInactive) {
      if (activeParam !== null) {
        where.active = activeParam === "true";
      } else {
        where.active = true;
      }
    }

    if (search) {
      where.name = { contains: search };
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        _count: {
          select: {
            attendanceItems: true,
            visitorsInvited: true,
            quarterHighlights: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(students);
  } catch (error) {
    console.error("Erro ao buscar alunos:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar aluno
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

    let {
      name, gender, birthDate, phone, address, guardian,
      classId, observations, baptized, member, newConvert, photo
    } = body;

    if (!name || !classId) {
      return NextResponse.json({ error: "Nome e classe são obrigatórios" }, { status: 400 });
    }

    const classExists = await prisma.class.findFirst({
      where: { id: classId, organizationId: activeOrganizationId }
    });

    if (!classExists) {
      return NextResponse.json({ error: "Classe não encontrada" }, { status: 404 });
    }

    const student = await prisma.student.create({
      data: {
        name,
        gender,
        birthDate: birthDate ? new Date(birthDate) : null,
        phone,
        address,
        guardian,
        classId,
        observations,
        baptized: baptized || false,
        member: member || false,
        newConvert: newConvert || false,
        photo,
        organizationId: activeOrganizationId,
      },
      include: { class: { select: { id: true, name: true } } },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar aluno:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
