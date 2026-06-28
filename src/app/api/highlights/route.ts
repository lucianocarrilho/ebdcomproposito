import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const quarterParam = searchParams.get("quarter");

    const where: any = {};

    if (quarterParam) {
      // Support both formats: "2026-Q2" and "2º Trimestre 2026"
      const quarterToHumanReadable = (q: string) => {
        const [yearStr, qStr] = q.split("-");
        const num = qStr.replace("Q", "");
        return `${num}º Trimestre ${yearStr}`;
      };

      // Check if it's in system format (e.g., "2026-Q2")
      if (/^\d{4}-Q\d$/.test(quarterParam)) {
        const quarterHuman = quarterToHumanReadable(quarterParam);
        where.quarter = { in: [quarterParam, quarterHuman] };
      } else {
        where.quarter = quarterParam;
      }
    }

    const highlights = await prisma.quarterHighlight.findMany({
      where,
      include: {
        student: {
          select: {
            name: true,
            photo: true,
            class: {
              select: { name: true }
            }
          }
        },
        class: {
          select: { name: true }
        }
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(highlights);
  } catch (error) {
    console.error("Error fetching highlights:", error);
    return NextResponse.json({ error: "Erro ao carregar destaques" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, classId, quarter, reason, type } = body;

    const highlight = await prisma.quarterHighlight.create({
      data: {
        studentId,
        classId,
        quarter,
        reason,
        type,
        date: new Date(),
      },
      include: {
        student: { select: { name: true } }
      }
    });

    return NextResponse.json(highlight);
  } catch (error) {
    console.error("Error creating highlight:", error);
    return NextResponse.json({ error: "Erro ao registrar destaque" }, { status: 500 });
  }
}
