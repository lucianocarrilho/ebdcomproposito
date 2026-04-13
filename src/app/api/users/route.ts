import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

// GET - Listar usuários
export async function GET(request: NextRequest) {
  try {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        image: true,
        birthDate: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST - Criar usuário
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, role, image, birthDate } = body;
 
    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "Todos os campos são obrigatórios" }, { status: 400 });
    }
 
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
 
    if (existingUser) {
      // Se o usuário existe mas está inativo, reativar com os novos dados
      if (!existingUser.active) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const reactivated = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            password: hashedPassword,
            role,
            image,
            birthDate,
            active: true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
          },
        });
        return NextResponse.json(reactivated, { status: 201 });
      }
      return NextResponse.json({ error: "Email já cadastrado" }, { status: 400 });
    }
 
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        image,
        birthDate,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
