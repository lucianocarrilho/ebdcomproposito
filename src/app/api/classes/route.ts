import { prisma } from "@/lib/prisma";
import { requireOrganization, getUserAssignedClasses } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

// GET - Listar classes
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireOrganization(true);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    
    const { activeOrganizationId, orgRole, user, membership, globalAdminMode } = authResult as any;

    const where: any = {
      organizationId: activeOrganizationId,
      status: true
    };
    
    // Full access roles for the active organization
    const hasFullAccess = globalAdminMode || orgRole === "ADMIN" || orgRole === "DIRIGENTE" || orgRole === "VICE_DIRIGENTE";

    if (!hasFullAccess) {
      // Restricted roles (PROFESSOR, APOIO) require active CSA assignments
      if (!membership?.id) {
        return NextResponse.json([]);
      }

      const { classIds } = await getUserAssignedClasses(user.id, activeOrganizationId, membership.id);

      if (!classIds || classIds.length === 0) {
        return NextResponse.json([]);
      }

      where.id = { in: classIds };
    }


    const classes = await prisma.class.findMany({
      where,
      include: {
        students: {
          where: { active: true },
          select: { id: true },
        },
        leaders: {
          where: { active: true },
          select: { name: true, role: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const formatted = classes.map((cls) => ({
      ...cls,
      active: cls.status,
      _count: {
        students: cls.students.length,
      },
      professor: cls.professor || cls.leaders.find((l) => l.role === "Professor")?.name || "",
      dirigente: cls.dirigente || cls.leaders.find((l) => l.role === "Dirigente")?.name || "",
      viceDirigente: cls.viceDirigente || cls.leaders.find((l) => l.role === "Vice-Dirigente")?.name || "",
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Erro ao buscar classes:", error);
    return NextResponse.json({ error: "Erro ao buscar classes" }, { status: 500 });
  }
}

// POST - Criar classe
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireOrganization(true);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    
    const { activeOrganizationId, orgRole } = authResult as any;

    // Only Admin or Dirigente can create classes
    if (orgRole !== "ADMIN" && orgRole !== "DIRIGENTE") {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, audience, active, professor, dirigente, viceDirigente, organizationId } = body;
    
    if (organizationId !== undefined) {
      return NextResponse.json({ error: "O campo organizationId não é permitido no corpo da requisição." }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const newClass = await prisma.class.create({
      data: { 
        name, 
        description, 
        audience, 
        professor,
        dirigente,
        viceDirigente,
        status: active !== undefined ? active : true,
        organizationId: activeOrganizationId
      },
    });

    return NextResponse.json(newClass, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar classe:", error);
    return NextResponse.json({ error: "Erro ao criar classe" }, { status: 500 });
  }
}
