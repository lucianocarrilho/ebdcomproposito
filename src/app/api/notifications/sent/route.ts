import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authResult = await requireOrganization(true);
    if ("error" in authResult || !("activeOrganizationId" in authResult)) {
      return NextResponse.json(
        { error: "error" in authResult ? authResult.error : "Organização não selecionada" },
        { status: "status" in authResult ? authResult.status : 403 }
      );
    }

    const { activeOrganizationId, user } = authResult;

    const userId = user.id;

    // 1. Fetch notifications
    const notifications = await prisma.notification.findMany({
      where: {
        senderId: userId,
        organizationId: activeOrganizationId,
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    if (!notifications || notifications.length === 0) return NextResponse.json([]);

    // 2. Fetch all reads for these notifications
    const notificationIds = notifications.map(n => n.id);
    const allReads = await prisma.notificationRead.findMany({
      where: {
        notificationId: { in: notificationIds }
      }
    });

    // 3. Fetch users involved
    const userIds = Array.from(new Set(allReads.map(r => r.userId)));
    const allUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true }
    });

    // 4. Assemble the final data manual to avoid Prisma "Unknown field" errors on joins
    const formatted = notifications.map(notif => {
      const readsForNotif = allReads.filter(r => r.notificationId === notif.id);

      return {
        ...notif,
        _count: {
          reads: readsForNotif.length
        },
        reads: readsForNotif.map(r => {
          const userObj = allUsers.find(u => u.id === r.userId);
          return {
            user: { name: userObj?.name || "Usuário" }
          };
        }).slice(0, 50)
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("Erro ao buscar avisos enviados:", error);
    return NextResponse.json({
      error: "Erro interno",
      details: error.message || "Sem detalhes extras"
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireOrganization(true);
    if ("error" in authResult || !("activeOrganizationId" in authResult)) {
      return NextResponse.json(
        { error: "error" in authResult ? authResult.error : "Organização não selecionada" },
        { status: "status" in authResult ? authResult.status : 403 }
      );
    }

    const { activeOrganizationId, orgRole, user, globalAdminMode } = authResult;

    const isManager = globalAdminMode || (orgRole ? ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE"].includes(orgRole) : false);

    if (!isManager) {
      return NextResponse.json(
        { error: "Acesso negado: Cargo sem permissão para excluir comunicado" },
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
        senderId: user.id,
        organizationId: activeOrganizationId,
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
