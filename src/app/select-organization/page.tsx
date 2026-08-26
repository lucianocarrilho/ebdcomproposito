"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, ArrowRight, ShieldAlert } from "lucide-react";

export default function SelectOrganizationPage() {
  const { data: session, update, status } = useSession();
  const router = useRouter();
  const [loadingOrgId, setLoadingOrgId] = useState<string | null>(null);

  const user = session?.user as any;
  const memberships = user?.memberships || [];
  
  // Efeito para tratar redirecionamento automático
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
    
    // Auto-login se houver apenas 1 congregação e não for Global Admin
    if (status === "authenticated" && memberships.length === 1 && !user.isGlobalAdmin && !user.activeOrganizationId && !loadingOrgId) {
      setLoadingOrgId(memberships[0].organizationId);
      update({ activeOrganizationId: memberships[0].organizationId }).then(() => {
        router.push("/dashboard");
      });
    }
  }, [status, memberships.length, user, loadingOrgId, router, update]);

  if (status === "loading" || !session?.user || (memberships.length === 1 && !user.isGlobalAdmin && !user.activeOrganizationId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }
  
  // Se usuário não for admin global e não tiver congregações, mostrar erro
  if (memberships.length === 0 && !user.isGlobalAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-xl max-w-md w-full text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Acesso Negado</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Você não possui vínculo ativo com nenhuma congregação. Por favor, contate a secretaria.
          </p>
        </div>
      </div>
    );
  }

  const handleSelect = async (orgId: string | null) => {
    setLoadingOrgId(orgId || "global");
    
    try {
      if (orgId) {
        const res = await fetch("/api/auth/switch-org", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: orgId })
        });
        
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Erro ao acessar congregação");
          setLoadingOrgId(null);
          return;
        }
      } else {
        const res = await fetch("/api/auth/clear-org", { method: "POST" });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Erro ao limpar congregação");
          setLoadingOrgId(null);
          return;
        }
      }

      // Se a validação no servidor passou, chama o update (que passará pelo JWT callback também)
      await update({ activeOrganizationId: orgId });
      
      if (!orgId) {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      alert("Erro de comunicação com o servidor.");
      setLoadingOrgId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="max-w-3xl mx-auto w-full">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            Selecione a Congregação
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Olá, {user.name}. Escolha qual área deseja acessar agora.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {memberships.map((membership: any) => (
            <button
              key={membership.organizationId}
              onClick={() => handleSelect(membership.organizationId)}
              disabled={!!loadingOrgId}
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-xl hover:shadow-2xl hover:border-blue-500 border-2 border-transparent transition-all duration-200 text-left relative"
            >
              <div className="px-6 py-8">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                    <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {membership.organizationName}
                    </h3>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-1">
                      Função: {membership.role}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 flex justify-between items-center border-t border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {loadingOrgId === membership.organizationId ? 'Acessando...' : 'Acessar painel'}
                </span>
                {loadingOrgId === membership.organizationId ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                ) : (
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500" />
                )}
              </div>
            </button>
          ))}
          
          {user.isGlobalAdmin && (
            <button
              onClick={() => handleSelect(null)}
              disabled={!!loadingOrgId}
              className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-black dark:to-gray-900 overflow-hidden shadow rounded-xl hover:shadow-2xl hover:ring-2 ring-gray-400 transition-all duration-200 text-left relative border border-gray-700"
            >
              <div className="px-6 py-8">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-white/10 p-3 rounded-lg">
                    <ShieldAlert className="h-8 w-8 text-white" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-xl font-bold text-white">
                      Administração Global
                    </h3>
                    <p className="text-sm font-medium text-gray-300 mt-1">
                      Painel do Sistema
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-black/20 px-6 py-4 flex justify-between items-center border-t border-gray-700">
                <span className="text-sm text-gray-300">
                  {loadingOrgId === "global" ? 'Acessando...' : 'Acessar administração'}
                </span>
                {loadingOrgId === "global" ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <ArrowRight className="h-5 w-5 text-gray-300" />
                )}
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
