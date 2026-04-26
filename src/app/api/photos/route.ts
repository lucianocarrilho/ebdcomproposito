import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ROLES = ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE", "PROFESSOR", "APOIO"];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !ALLOWED_ROLES.includes((session.user as any)?.role)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const type = searchParams.get("type");

    const where: any = {};
    if (classId && classId !== "Todas") where.classId = classId;
    if (type && type !== "Todos") where.type = type;

    const albums = await prisma.photoAlbum.findMany({
      where,
      include: {
        class: { select: { name: true } },
        _count: { select: { photos: true } },
        photos: { take: 1, orderBy: { createdAt: "asc" }, select: { url: true } },
      },
      orderBy: { date: "desc" },
    });

    const formatted = albums.map(a => ({
      id: a.id,
      title: a.title,
      description: a.description,
      date: a.date,
      type: a.type,
      classId: a.classId,
      className: a.class?.name || "Geral",
      coverUrl: a.coverUrl || a.photos[0]?.url || null,
      photoCount: a._count.photos,
      createdById: a.createdById,
      createdAt: a.createdAt,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Erro ao buscar álbuns:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    if (!session || !ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, date, type, classId, photos } = body;

    if (!title || !date) {
      return NextResponse.json({ error: "Título e data são obrigatórios" }, { status: 400 });
    }

    const album = await prisma.photoAlbum.create({
      data: {
        title,
        description: description || null,
        date: new Date(date + "T12:00:00.000Z"),
        type: type || "aula",
        classId: classId || null,
        coverUrl: photos?.[0]?.url || null,
        createdById: (session.user as any)?.id || null,
        photos: {
          create: (photos || []).map((p: any) => ({
            url: p.url,
            caption: p.caption || null,
          })),
        },
      },
      include: {
        photos: true,
        class: { select: { name: true } },
      },
    });

    return NextResponse.json(album);
  } catch (error) {
    console.error("Erro ao criar álbum:", error);
    return NextResponse.json({ error: "Erro ao criar álbum" }, { status: 500 });
  }
}
