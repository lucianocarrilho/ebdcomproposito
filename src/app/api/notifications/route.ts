import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";
import { requireOrganization } from "@/lib/organization-guard";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult.authorized) {
      return authResult.response;
    }
    const session = authResult.session;

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    // Lógica Multi-tenant isolada (S3A.2)
    const orgResult = await requireOrganization(req, {
      requireActiveOrg: false,
      allowGlobalAdminFallback: false,
    });

    if (!orgResult.authorized) {
      return orgResult.response;
    }

    const { organizationId, isGlobalAdmin, activeOrgId } = orgResult;

    // Se o usuário tiver um activeOrganizationId ou organização resolvida via guard
    if (organizationId || activeOrgId) {
      const targetOrgId = organizationId || activeOrgId;

      // Buscar membership ativa do usuário para determinar seu pertencimento à organização
      const membership = await prisma.organizationMembership.findFirst({
        where: {
          userId: session.user.id,
          organizationId: targetOrgId,
          status: "ACTIVE",
        },
      });

      // Se não possui membership ativa e não é Global Admin, 403 Forbidden
      if (!membership && !isGlobalAdmin) {
        return NextResponse.json(
          { error: "Acesso negado: Usuário não é membro ativo desta organização" },
          { status: 403 }
        );
      }

      // Buscar notificações ativas da organização (Broadcast OR Pessoal direcionada ao userId)
      const notifications = await prisma.notification.findMany({
        where: {
          active: true,
          organizationId: targetOrgId,
          OR: [
            { userId: null }, // Broadcast para a congregação
            { userId: session.user.id }, // Notificação pessoal
          ],
          AND: [
            {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } },
              ],
            },
          ],
        },
        include: {
          reads: {
            where: {
              userId: session.user.id,
            },
          },
          sender: {
            select: {
              name: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Mapear propriedade read com base em reads array
      const mapped = notifications.map((n) => {
        const isRead = n.reads.length > 0;
        const { reads, ...rest } = n;
        return {
          ...rest,
          read: isRead,
        };
      });

      const filtered = unreadOnly ? mapped.filter((n) => !n.read) : mapped;
      return NextResponse.json(filtered);
    }

    // Comportamento Legacy (Sem organização ativa e sem header x-organization-id)
    const notifications = await prisma.notification.findMany({
      where: {
        active: true,
        OR: [
          { userId: null },
          { userId: session.user.id },
        ],
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        ],
      },
      include: {
        reads: {
          where: {
            userId: session.user.id,
          },
        },
        sender: {
          select: {
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const mapped = notifications.map((n) => {
      const isRead = n.reads.length > 0;
      const { reads, ...rest } = n;
      return {
        ...rest,
        read: isRead,
      };
    });

    const filtered = unreadOnly ? mapped.filter((n) => !n.read) : mapped;
    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar notificações" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult.authorized) {
      return authResult.response;
    }
    const session = authResult.session;

    const orgResult = await requireOrganization(req, {
      requireActiveOrg: true,
      allowGlobalAdminFallback: false,
    });

    if (!orgResult.authorized) {
      return orgResult.response;
    }

    const { organizationId, isGlobalAdmin } = orgResult;

    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: session.user.id,
        organizationId: organizationId!,
        status: "ACTIVE",
      },
    });

    if (!membership && !isGlobalAdmin) {
      return NextResponse.json(
        { error: "Acesso negado: Membro inativo ou não pertencente a esta organização" },
        { status: 403 }
      );
    }

    const orgRole = membership?.role || (isGlobalAdmin ? "ADMIN" : null);

    if (orgRole !== "ADMIN" && orgRole !== "DIRIGENTE" && orgRole !== "VICE_DIRIGENTE") {
      return NextResponse.json(
        { error: "Acesso negado: Cargo sem permissão para disparar comunicados" },
        { status: 403 }
      );
    }

    const body = await req.json();

    if ("organizationId" in body || "senderId" in body) {
      return NextResponse.json(
        { error: "Campos controlados pelo servidor não podem ser enviados pelo cliente" },
        { status: 400 }
      );
    }

    const { title, message, type, targetUserId, expiresAt } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: "title e message são obrigatórios" },
        { status: 400 }
      );
    }

    let parsedExpiresAt: Date | null = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (isNaN(parsedExpiresAt.getTime())) {
        return NextResponse.json(
          { error: "Data de expiração inválida" },
          { status: 400 }
        );
      }
      if (parsedExpiresAt.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: "Data de expiração deve ser no futuro" },
          { status: 400 }
        );
      }
    }

    if (targetUserId) {
      const targetMembership = await prisma.organizationMembership.findFirst({
        where: {
          userId: targetUserId,
          organizationId: organizationId!,
          status: "ACTIVE",
        },
      });

      if (!targetMembership) {
        return NextResponse.json(
          { error: "Usuário destinatário não encontrado ou inativo nesta organização" },
          { status: 404 }
        );
      }
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type: type || "info",
        userId: targetUserId || null,
        senderId: session.user.id,
        organizationId: organizationId!,
        expiresAt: parsedExpiresAt,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar notificação:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor ao disparar notificação" },
      { status: 500 }
    );
  }
}
