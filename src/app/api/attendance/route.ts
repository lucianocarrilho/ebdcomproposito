import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/permissions";

// GET - Buscar chamada por data e classe
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");

    if (!classId || !date) {
      return NextResponse.json(
        { error: "classId e date são obrigatórios" },
        { status: 400 }
      );
    }

    const parsedDate = new Date(date + "T00:00:00.000Z");

    // Get existing record
    const record = await prisma.attendanceRecord.findUnique({
      where: {
        date_classId: { date: parsedDate, classId },
      },
      include: {
        items: {
          include: { student: { select: { id: true, name: true, photo: true } } },
        },
      },
    });

    // Get all students for the class
    const students = await prisma.student.findMany({
      where: { classId, active: true },
      select: { id: true, name: true, photo: true },
      orderBy: { name: "asc" },
    });

    // Merge data
    const attendanceList = students.map((student) => {
      const item = record?.items.find((i) => i.studentId === student.id);
      return {
        studentId: student.id,
        studentName: student.name,
        photo: student.photo || null,
        status: item?.status || "",
        observations: item?.observations || "",
      };
    });

    return NextResponse.json({
      record: record ? {
        ...record,
        biblias: record.biblias || 0,
        revistas: record.revistas || 0,
        ofertas: record.ofertas ? Number(record.ofertas) : 0,
        outros: record.outros || 0,
      } : null,
      students: attendanceList,
    });
  } catch (error) {
    console.error("Erro ao buscar presença:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireOrganization(true);
    if ("error" in authResult || !("activeOrganizationId" in authResult)) {
      return NextResponse.json(
        { error: "error" in authResult ? authResult.error : "Organização não selecionada" },
        { status: "status" in authResult ? authResult.status : 403 }
      );
    }

    const { activeOrganizationId, orgRole, membership, user, globalAdminMode } = authResult;

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
        organizationId: activeOrganizationId,
      },
    });

    if (!targetClass) {
      return NextResponse.json(
        { error: "Turma não encontrada nesta organização" },
        { status: 404 }
      );
    }

    const isManager = globalAdminMode || (orgRole ? ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE"].includes(orgRole) : false);

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
          organizationId: activeOrganizationId,
          active: true,
        },
      });

      if (!csa) {
        return NextResponse.json(
          { error: "Acesso negado: Turma não atribuída a este usuário" },
          { status: 403 }
        );
      }
    } else if (!isManager) {
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
          organizationId: activeOrganizationId,
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
            organizationId: activeOrganizationId,
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
            organizationId: activeOrganizationId,
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
                organizationId: activeOrganizationId,
              },
            });

            if (existingJust) {
              await tx.absenceJustification.update({
                where: { id: existingJust.id },
                data: {
                  reason: reasonText,
                  observations: item.observations || null,
                  registeredById: user.id,
                },
              });
            } else {
              await tx.absenceJustification.create({
                data: {
                  studentId: item.studentId,
                  date: targetDate,
                  reason: reasonText,
                  observations: item.observations || null,
                  organizationId: activeOrganizationId,
                  registeredById: user.id,
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
