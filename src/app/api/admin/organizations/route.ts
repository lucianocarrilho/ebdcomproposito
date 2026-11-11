import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/permissions";
import {
  ORGANIZATION_ADMIN_SELECT,
  hasPrismaErrorCode,
  parseCreateOrganizationInput,
} from "@/lib/organization-validation";

export async function GET() {
  try {
    const authResult = await requireGlobalAdmin(true);
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const organizations = await prisma.organization.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
      select: ORGANIZATION_ADMIN_SELECT,
    });

    return NextResponse.json(organizations);
  } catch (error) {
    console.error("[API Admin Organizations GET] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno ao listar congregações." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireGlobalAdmin(true);
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Payload JSON inválido." },
        { status: 400 }
      );
    }

    const parsed = parseCreateOrganizationInput(rawBody);
    if (!parsed.valid) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const existingSlug = await prisma.organization.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true },
    });

    if (existingSlug) {
      return NextResponse.json(
        { error: "Já existe uma congregação cadastrada com este slug." },
        { status: 409 }
      );
    }

    const created = await prisma.organization.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        active: parsed.data.active,
      },
      select: ORGANIZATION_ADMIN_SELECT,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { error: "Já existe uma congregação cadastrada com este slug." },
        { status: 409 }
      );
    }
    console.error("[API Admin Organizations POST] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno ao criar congregação." },
      { status: 500 }
    );
  }
}
