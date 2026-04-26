import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const album = await prisma.photoAlbum.findUnique({
      where: { id },
      include: {
        class: { select: { name: true } },
        photos: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!album) {
      return NextResponse.json({ error: "Álbum não encontrado" }, { status: 404 });
    }

    return NextResponse.json(album);
  } catch (error) {
    console.error("Erro ao buscar álbum:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    if (!session || !["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE", "PROFESSOR"].includes(userRole)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, date, type, classId, newPhotos } = body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) updateData.date = new Date(date + "T12:00:00.000Z");
    if (type !== undefined) updateData.type = type;
    if (classId !== undefined) updateData.classId = classId || null;

    const album = await prisma.photoAlbum.update({
      where: { id },
      data: updateData,
    });

    // Adicionar novas fotos se enviadas
    if (newPhotos && Array.isArray(newPhotos) && newPhotos.length > 0) {
      await prisma.photoItem.createMany({
        data: newPhotos.map((p: any) => ({
          albumId: id,
          url: p.url,
          caption: p.caption || null,
        })),
      });
    }

    const updated = await prisma.photoAlbum.findUnique({
      where: { id },
      include: {
        photos: { orderBy: { createdAt: "asc" } },
        class: { select: { name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar álbum:", error);
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    // Apenas admins podem excluir álbuns completos
    if (!session || !["ADMIN"].includes(userRole)) {
      return NextResponse.json({ error: "Apenas administradores podem excluir álbuns" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.photoAlbum.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir álbum:", error);
    return NextResponse.json({ error: "Erro ao excluir" }, { status: 500 });
  }
}
