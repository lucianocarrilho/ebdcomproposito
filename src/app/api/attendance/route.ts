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

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");

    if (!classId || !date) {
      return NextResponse.json(
        { error: "classId e date são obrigatórios" },
        { status: 400 }
      );
    }

    // Usar Date em UTC para evitar discrepâncias de fuso horário
    const targetDate = new Date(`${date}T00:00:00.000Z`);

    const record = await prisma.attendanceRecord.findFirst({
      where: {
        classId,
        date: targetDate,
      },
      include: {
        items: true,
      },
    });

    if (!record) {
      return NextResponse.json(null);
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("Erro ao buscar presença:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar presença" },
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

    const body = await req.json();

    if ("organizationId" in body || "senderId" in body || "registeredById" in body) {
      return NextResponse.json(
        { error: "Campos controlados pelo servidor não podem ser enviados pelo cliente" },
        { status: 400 }
      );
    }

    const { classId, date, observations, biblias, revistas, ofertas, outros, items } = body;

    if (!classId || !date || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "classId, date e items são obrigatórios" },
        { status: 400 }
      );
    }

    const targetDate = new Date(`${date}T00:00:00.000Z`);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { error: "Data inválida" },
        { status: 400 }
      );
    }

    const targetClass = await prisma.class.findFirst({
      where: {
        id: classId,
        organizationId: organizationId!,
      },
    });

    if (!targetClass) {
      return NextResponse.json(
        { error: "Turma não encontrada nesta organização" },
        { status: 404 }
      );
    }

    if (orgRole === "PROFESSOR" || orgRole === "APOIO") {
      if (!membership) {
        return NextResponse.json(
          { error: "Acesso negado: Membership não encontrada" },
          { status: 403 }
        );
      }

      const csa = await prisma.classStaffAssignment.findFirst({
        where: {
          organizationMembershipId: membership.id,
          classId,
          organizationId: organizationId!,
          active: true,
        },
      });

      if (!csa) {
        return NextResponse.json(
          { error: "Acesso negado: Turma não atribuída a este usuário" },
          { status: 403 }
        );
      }
    } else if (orgRole !== "ADMIN" && orgRole !== "DIRIGENTE" && orgRole !== "VICE_DIRIGENTE") {
      return NextResponse.json(
        { error: "Acesso negado: Cargo sem permissão para registrar chamada" },
        { status: 403 }
      );
    }

    const studentIds = items.map((i: any) => i.studentId);
    const uniqueStudentIds = new Set(studentIds);

    if (studentIds.length !== uniqueStudentIds.size) {
      return NextResponse.json(
        { error: "Lista de presença contém estudantes duplicados" },
        { status: 400 }
      );
    }

    if (studentIds.length > 0) {
      const validStudentsCount = await prisma.student.count({
        where: {
          id: { in: studentIds },
          classId,
          organizationId: organizationId!,
        },
      });

      if (validStudentsCount !== studentIds.length) {
        return NextResponse.json(
          { error: "Um ou mais estudantes não pertencem a esta turma e organização" },
          { status: 404 }
        );
      }
    }

    const record = await prisma.$transaction(async (tx) => {
      let rec = await tx.attendanceRecord.findFirst({
        where: {
          classId,
          date: targetDate,
        },
      });

      if (rec) {
        rec = await tx.attendanceRecord.update({
          where: { id: rec.id },
          data: {
            observations,
            biblias: biblias !== undefined ? Number(biblias) : undefined,
            revistas: revistas !== undefined ? Number(revistas) : undefined,
            ofertas: ofertas !== undefined ? Number(ofertas) : undefined,
            outros: outros !== undefined ? Number(outros) : undefined,
            organizationId: organizationId!,
          },
        });

        await tx.attendanceItem.deleteMany({
          where: { recordId: rec.id },
        });
      } else {
        rec = await tx.attendanceRecord.create({
          data: {
            classId,
            date: targetDate,
            observations,
            biblias: biblias !== undefined ? Number(biblias) : 0,
            revistas: revistas !== undefined ? Number(revistas) : 0,
            ofertas: ofertas !== undefined ? Number(ofertas) : 0,
            outros: outros !== undefined ? Number(outros) : 0,
            organizationId: organizationId!,
          },
        });
      }

      if (items.length > 0) {
        await tx.attendanceItem.createMany({
          data: items.map((item: any) => ({
            recordId: rec.id,
            studentId: item.studentId,
            status: item.status,
            observations: item.observations || null,
          })),
        });

        for (const item of items) {
          if (item.status === "FALTA_JUSTIFICADA") {
            const reasonText = item.observations || "Falta Justificada registrada na chamada";

            const existingJust = await tx.absenceJustification.findFirst({
              where: {
                studentId: item.studentId,
                date: targetDate,
                organizationId: organizationId!,
              },
            });

            if (existingJust) {
              await tx.absenceJustification.update({
                where: { id: existingJust.id },
                data: {
                  reason: reasonText,
                  observations: item.observations || null,
                  registeredById: session.user.id,
                },
              });
            } else {
              await tx.absenceJustification.create({
                data: {
                  studentId: item.studentId,
                  date: targetDate,
                  reason: reasonText,
                  observations: item.observations || null,
                  organizationId: organizationId!,
                  registeredById: session.user.id,
                },
              });
            }
          }
        }
      }

      return rec;
    });

    return NextResponse.json({ success: true, recordId: record.id });
  } catch (error) {
    console.error("Erro ao salvar presença:", error);
    return NextResponse.json(
      { error: "Erro interno ao salvar presença" },
      { status: 500 }
    );
  }
}
