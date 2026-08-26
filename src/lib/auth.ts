import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: true,
  secret: process.env.AUTH_SECRET || "ebd-com-proposito-secret-key-2026",
  trustHost: true,
  providers: [
    Credentials({
      id: "credentials",
      name: "Credenciais",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const fs = require('fs');
        const log = (msg: string) => {
          console.log(msg);
          fs.appendFileSync('auth_debug.log', msg + '\n');
        };

        log("[Auth] Autorizando: " + credentials?.email);
        
        try {
          if (!credentials?.email || !credentials?.password) {
            log("[Auth] Falha: email ou senha ausentes");
            return null;
          }

          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
            include: {
              memberships: {
                where: { status: 'ACTIVE' },
                include: { organization: true }
              }
            }
          });

          log("[Auth] User debug: " + (user ? "Encontrado" : "Não encontrado"));

          if (!user) {
            log("[Auth] Falha: Usuário nulo");
            return null;
          }
          if (!user.active) {
            log("[Auth] Falha: Usuário inativo");
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          log("[Auth] Password debug: " + (isPasswordValid ? "Válida" : "Inválida"));

          if (!isPasswordValid) {
            log("[Auth] Falha: Senha inválida");
            return null;
          }

          const validMemberships = user.memberships
            .filter(m => m.organization.active)
            .map(m => ({
              organizationId: m.organizationId,
              organizationName: m.organization.name,
              organizationSlug: m.organization.slug,
              role: m.role
            }));
          
          log("[Auth] Retornando usuário com sucesso.");

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: (user as any).role,
            classId: (user as any).classId,
            isGlobalAdmin: user.isGlobalAdmin,
            validMemberships
          };
        } catch (error) {
          log("[Auth] Authorize error: " + (error as any).message);
          console.error(error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as any).role;
        token.classId = (user as any).classId;
        token.isGlobalAdmin = (user as any).isGlobalAdmin;
        token.memberships = (user as any).validMemberships;
      }
      
      console.log(`[JWT] trigger: ${trigger}, session.activeOrgId: ${session?.activeOrganizationId}`);
      
      if (trigger === "update" && session !== undefined) {
        if ("activeOrganizationId" in session) {
          const requestedOrgId = session.activeOrganizationId;
          console.log(`[JWT] Requisitando mudança para: ${requestedOrgId}`);
          
          if (requestedOrgId === null) {
            // Clear context (Global Admin returning to global mode)
            if (token.isGlobalAdmin) {
              token.activeOrganizationId = null;
              token.activeOrganizationName = null;
              token.globalAdminMode = false;
              console.log("[JWT] Contexto limpo");
            }
          } else {
            // Server-side validation
            try {
              const org = await prisma.organization.findUnique({
                where: { id: requestedOrgId }
              });
              
              if (org && org.active) {
                if (token.isGlobalAdmin) {
                  token.activeOrganizationId = requestedOrgId;
                  token.activeOrganizationName = org.name;
                  token.globalAdminMode = true;
                  console.log("[JWT] Admin Global ativado");
                } else if (token.sub) {
                  const membership = await prisma.organizationMembership.findUnique({
                    where: {
                      userId_organizationId: {
                        userId: token.sub,
                        organizationId: requestedOrgId
                      }
                    }
                  });
                  
                  if (membership && membership.status === "ACTIVE") {
                    token.activeOrganizationId = requestedOrgId;
                    token.activeOrganizationName = org.name;
                    token.globalAdminMode = false;
                    console.log(`[JWT] Usuário autorizado para: ${requestedOrgId}`);
                  } else {
                    console.log("[JWT] Vínculo não encontrado ou inativo");
                  }
                }
              } else {
                console.log("[JWT] Org inválida ou inativa");
              }
            } catch (error) {
              console.error("[Auth] Erro ao revalidar organização no JWT", error);
            }
          }
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).classId = token.classId;
        (session.user as any).isGlobalAdmin = token.isGlobalAdmin;
        (session.user as any).memberships = token.memberships;
        (session.user as any).activeOrganizationId = token.activeOrganizationId;
        (session.user as any).activeOrganizationName = token.activeOrganizationName;
        (session.user as any).globalAdminMode = token.globalAdminMode;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  pages: {
    signIn: "/",
    error: "/auth/error",
  },
});
