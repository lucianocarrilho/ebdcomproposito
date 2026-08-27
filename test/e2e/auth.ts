import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

// Cria um usuário, organização, membership e classe, e retorna os cookies de sessão
export async function setupTestUserAndLogin(orgName: string, role: string = "ADMIN") {
  const testId = randomUUID();
  const email = `test_${testId}@test.com`;
  const password = "password123";

  // Cria a organização
  const org = await prisma.organization.create({
    data: {
      name: orgName,
      slug: `org-${testId}`,
      active: true
    }
  });

  // Cria o usuário
  const user = await prisma.user.create({
    data: {
      name: `Test User ${testId}`,
      email,
      password: "dummy_hashed_password", // The Credentials provider bypasses real bcrypt if we use a test strategy, or we need to hash it.
      active: true,
      role: role as any // Legacy role, will be ignored by new logic but needed by schema
    }
  });

  // Hash real for bcrypt (password123): $2a$10$w092z6M.X8o4G1qG8A8w.O... we will use bcryptjs to hash it so NextAuth passes
  const bcrypt = require("bcryptjs");
  const hashed = bcrypt.hashSync(password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

  // Cria o vínculo
  await prisma.organizationMembership.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      role: role as any,
      status: "ACTIVE"
    }
  });

  // Autenticar no servidor Next.js
  const baseUrl = "http://localhost:3100";

  // 1. Get CSRF Token
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  const cookies = csrfRes.headers.get("set-cookie") || "";
  const parsedCookies = cookies.split(",").map(c => c.split(";")[0]).join("; ");

  // 2. Login
  const loginForm = new URLSearchParams();
  loginForm.append("email", email);
  loginForm.append("password", password);
  loginForm.append("csrfToken", csrfToken);
  loginForm.append("json", "true");

  const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": parsedCookies
    },
    body: loginForm.toString(),
    redirect: "manual"
  });

  const sessionCookies = loginRes.headers.get("set-cookie") || "";
  const finalCookies = `${parsedCookies}; ${sessionCookies.split(",").map(c => c.split(";")[0]).join("; ")}`;

  // 3. Selecionar Organização (Switch Org)
  // Fetch new CSRF token after login
  const csrfRes2 = await fetch(`${baseUrl}/api/auth/csrf`, { headers: { "Cookie": finalCookies } });
  const csrfData2 = await csrfRes2.json();
  const csrfToken2 = csrfData2.csrfToken;

  // We must call NextAuth's update() endpoint directly to modify the JWT
  const switchRes = await fetch(`${baseUrl}/api/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": finalCookies
    },
    body: JSON.stringify({
      csrfToken: csrfToken2,
      data: { activeOrganizationId: org.id }
    })
  });

  let activeCookies = finalCookies;
  if (switchRes.ok) {
    const swCookies = switchRes.headers.get("set-cookie") || "";
    console.log("[Test Debug] switchRes cookies:", swCookies);
    const text = await switchRes.text();
    console.log("[Test Debug] switchRes body:", text);

    // Regex para pegar authjs.session-token ou __Secure-authjs.session-token
    const match = swCookies.match(/((?:__Secure-)?authjs\.session-token=[^;]+)/);
    if (match) {
      if (activeCookies.includes('authjs.session-token=')) {
        activeCookies = activeCookies.replace(/(?:__Secure-)?authjs\.session-token=[^;]+/, match[1]);
      } else {
        activeCookies = `${activeCookies}; ${match[1]}`;
      }
      console.log("[Test Debug] activeCookies successfully replaced with new token.");
    } else {
      console.log("[Test Debug] FATAL: NO SESSION TOKEN IN RESPONSE!");
    }
  } else {
    console.log("[Test Debug] FATAL: switchRes NOT OK", switchRes.status);
  }

  // Cria uma classe para testar alunos
  const classObj = await prisma.class.create({
    data: {
      name: `Class ${testId}`,
      organization: { connect: { id: org.id } },
      status: true
    }
  });

  return {
    user,
    org,
    classId: classObj.id,
    cookies: activeCookies,
    testId,
    cleanup: async () => {
      // Limpeza controlada
      await prisma.student.deleteMany({ where: { organizationId: org.id } });
      await prisma.leader.deleteMany({ where: { organizationId: org.id } });
      await prisma.class.deleteMany({ where: { id: classObj.id } });
      await prisma.organizationMembership.deleteMany({ where: { organizationId: org.id } });
      await prisma.organization.delete({ where: { id: org.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  };
}
