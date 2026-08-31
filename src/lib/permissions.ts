import { auth } from "./auth";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

export async function requireAuth(isApi = false) {
  const session = await auth();
  if (!session || !session.user) {
    if (isApi) return { error: "Não autorizado", status: 401 };
    redirect("/");
  }
  
  const user = session.user as any;
  return { session, user };
}

export async function requireOrganization(isApi = false) {
  const authResult = await requireAuth(isApi);
  if ('error' in authResult) return authResult; // Early return for API error

  const { session, user } = authResult;

  if (!user.activeOrganizationId) {
    if (isApi) return { error: "Organização não selecionada", status: 403 };
    redirect("/select-organization");
  }

  // Revalidate with database
  const org = await prisma.organization.findUnique({
    where: { id: user.activeOrganizationId }
  });

  if (!org || !org.active) {
    if (isApi) return { error: "Organização inválida ou inativa", status: 403 };
    redirect("/select-organization");
  }

  let membership: any = null;
  let orgRole: any = null;
  let globalAdminMode = false;

  if (user.isGlobalAdmin && user.globalAdminMode) {
    globalAdminMode = true;
    orgRole = "ADMIN"; // Virtual role for operations
    // Global Admin might also have a real membership in the active organization
    membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.activeOrganizationId
        }
      }
    });
  } else {
    membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: user.activeOrganizationId
        }
      }
    });

    if (!membership || membership.status !== "ACTIVE") {
      if (isApi) return { error: "Vínculo inválido ou inativo", status: 403 };
      redirect("/select-organization");
    }
    orgRole = membership.role;
  }

  return {
    session,
    user,
    activeOrganizationId: user.activeOrganizationId,
    orgRole,
    membership,
    isGlobalAdmin: user.isGlobalAdmin,
    globalAdminMode
  };
}

export interface AssignedClassResult {
  classIds: string[];
  assignments: {
    classId: string;
    assignmentRole: "PROFESSOR" | "AUXILIAR";
  }[];
}

/**
 * Consulta autorizada de turmas atribuídas via ClassStaffAssignment.
 * Valida simultaneamente a integridade da Membership e a ativação da atribuição.
 */
export async function getUserAssignedClasses(
  userId: string,
  activeOrganizationId: string,
  organizationMembershipId: string
): Promise<AssignedClassResult> {
  if (!userId || !activeOrganizationId || !organizationMembershipId) {
    return { classIds: [], assignments: [] };
  }

  const assignments = await prisma.classStaffAssignment.findMany({
    where: {
      organizationId: activeOrganizationId,
      organizationMembershipId: organizationMembershipId,
      active: true,
      membership: {
        id: organizationMembershipId,
        userId: userId,
        organizationId: activeOrganizationId,
        status: "ACTIVE"
      }
    },
    select: {
      classId: true,
      assignmentRole: true
    }
  });

  return {
    classIds: assignments.map((a) => a.classId),
    assignments: assignments.map((a) => ({
      classId: a.classId,
      assignmentRole: a.assignmentRole as "PROFESSOR" | "AUXILIAR"
    }))
  };
}

export async function requireGlobalAdmin(isApi = false) {
  const authResult = await requireAuth(isApi);
  if ('error' in authResult) return authResult;

  const { session, user } = authResult;
  if (!user.isGlobalAdmin) {
    if (isApi) return { error: "Permissão insuficiente", status: 403 };
    redirect("/select-organization");
  }
  return { session, user };
}
