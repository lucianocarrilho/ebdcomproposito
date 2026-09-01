import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';
import { requireOrganization } from '@/lib/organization-guard';

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult.authorized) {
      return authResult.response;
    }
    const session = authResult.session;

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

      // Buscar notificações enviadas pelo usuário nesta organização
      const sentNotifications = await prisma.notification.findMany({
        where: {
          senderId: session.user.id,
          organizationId: targetOrgId,
        },
        include: {
          reads: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return NextResponse.json(sentNotifications);
    }

    // Comportamento Legacy (Sem organização ativa e sem header x-organization-id)
    const sentNotifications = await prisma.notification.findMany({
      where: {
        senderId: session.user.id,
      },
      include: {
        reads: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(sentNotifications);
  } catch (error) {
    console.error('Erro ao buscar notificações enviadas:', error);
    return NextResponse.json(
      { error: 'Erro interno ao buscar avisos enviados' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID do aviso é obrigatório' },
        { status: 400 }
      );
    }

    const deleteResult = await prisma.notification.deleteMany({
      where: {
        id,
        senderId: session.user.id,
        organizationId: organizationId!,
      },
    });

    if (deleteResult.count === 0) {
      return NextResponse.json(
        { error: 'Aviso não encontrado ou sem permissão para excluí-lo' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Aviso excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir aviso:', error);
    return NextResponse.json(
      { error: 'Erro interno ao excluir aviso' },
      { status: 500 }
    );
  }
}
