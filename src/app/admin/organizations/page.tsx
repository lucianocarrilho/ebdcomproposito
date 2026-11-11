import { requireGlobalAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ORGANIZATION_ADMIN_SELECT } from "@/lib/organization-validation";
import OrganizationsManager from "@/components/admin/OrganizationsManager";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage() {
  await requireGlobalAdmin();

  const organizations = await prisma.organization.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    select: ORGANIZATION_ADMIN_SELECT,
  });

  const serialized = organizations.map((org) => ({
    ...org,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  }));

  return <OrganizationsManager initialOrganizations={serialized} />;
}
