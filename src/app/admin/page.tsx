import { requireGlobalAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Building2, Users } from "lucide-react";
import OrgAccessButton from "@/components/admin/OrgAccessButton";

export default async function AdminPage() {
  await requireGlobalAdmin();
  
  // Apenas informações administrativas globais
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: 'asc' }
  });
  
  const totalUsers = await prisma.user.count();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administração Global</h1>
        <p className="text-gray-500">Visão sistêmica de todas as congregações cadastradas.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Congregações</p>
            <p className="text-2xl font-bold text-gray-900">{organizations.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total de Usuários</p>
            <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Congregações Cadastradas</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {organizations.map((org) => (
            <div key={org.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{org.name}</p>
                  <p className="text-sm text-gray-500">{org.slug}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${org.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {org.active ? 'Ativa' : 'Inativa'}
                </span>
                <OrgAccessButton orgId={org.id} active={org.active} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
