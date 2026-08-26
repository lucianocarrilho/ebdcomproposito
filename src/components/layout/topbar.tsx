"use client";

import React, { useState, useEffect } from "react";
import { Bell, Search, User, LogOut, Building2 } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getGreeting } from "@/lib/utils";
import { NotificationTray } from "./NotificationTray";
 
const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  DIRIGENTE: "Dirigente",
  VICE_DIRIGENTE: "Vice-Dirigente",
  PROFESSOR: "Professor",
  APOIO: "Apoio/Secretaria",
};
 
export function Topbar() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [liveImage, setLiveImage] = useState<string | null>(null);
  const userName = session?.user?.name || "Usuário";
  const user = session?.user as Record<string, any>;
  const activeOrgId = user?.activeOrganizationId;
  const memberships = user?.memberships || [];
  
  const currentMembership = memberships.find((m: any) => m.organizationId === activeOrgId);
  const userRole = currentMembership?.role || user?.role || "APOIO";
  const orgName = user?.activeOrganizationName || currentMembership?.organizationName || (user?.isGlobalAdmin ? "Admin Global" : "Sem Congregação");
 
  // Buscar foto atualizada para contornar cache da sessão
  useEffect(() => {
    async function syncUserPhoto() {
      if (user?.email) {
        try {
          const res = await fetch("/api/users");
          const users = await res.json();
          const currentUser = users.find((u: any) => u.email === user.email);
          if (currentUser?.image) {
            setLiveImage(currentUser.image);
          }
        } catch (e) {
          console.error("Erro ao sincronizar foto:", e);
        }
      }
    }
    syncUserPhoto();
  }, [session]);
 
  const userImage = liveImage || user?.image;

  const handleReturnToAdmin = async () => {
    try {
      const res = await fetch("/api/auth/clear-org", {
        method: "POST",
      });
      if (res.ok) {
        await update({ activeOrganizationId: null });
        router.push("/admin");
        router.refresh();
      } else {
        console.error("Erro ao limpar contexto global");
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
      {/* Left - Title/Search */}
      <div className="flex items-center gap-4 flex-1 pl-12 lg:pl-0">
        <div className="hidden sm:block text-sm text-gray-500">
          {getGreeting()}, <span className="font-semibold text-gray-900">{userName}</span>
        </div>
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={!activeOrgId ? "Buscar congregações ou usuários..." : "Buscar alunos, classes..."}
            className="pl-9 w-64 bg-gray-50 border-gray-200"
          />
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2">
        
        {/* Active Organization Badge */}
        <div className="hidden md:flex flex-col items-end mr-2">
          <span className="text-[10px] uppercase font-bold text-gray-400">
            {activeOrgId ? "Congregação Atual" : "Modo Global"}
          </span>
          <span className={`text-sm font-semibold truncate max-w-[150px] ${activeOrgId ? 'text-blue-600' : 'text-purple-600'}`}>
            {orgName}
          </span>
        </div>

        <NotificationTray />

        <div className="h-8 w-px bg-gray-200 mx-1" />

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm ring-1 ring-gray-100">
            {userImage ? (
              <img 
                src={userImage} 
                alt={userName} 
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-gray-900 leading-none">{userName}</p>
            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-tighter font-semibold">
              {!activeOrgId && user?.isGlobalAdmin ? "SUPERADMIN" : (roleLabels[userRole] || userRole)}
            </p>
          </div>
        </div>

        {/* Retorno Administração Global Button */}
        {user?.isGlobalAdmin && activeOrgId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReturnToAdmin}
            title="Voltar à Administração Global"
            className="text-purple-600 hover:text-purple-800 hover:bg-purple-50 text-xs font-semibold px-2 ml-2"
          >
            Voltar a Admin Global
          </Button>
        )}

        {/* Switch Congregation Button */}
        {(memberships.length > 1 || user?.isGlobalAdmin) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.location.href = "/select-organization"}
            title="Trocar Congregação"
            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 ml-1"
          >
            <Building2 className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut({ callbackUrl: "/" })}
          title="Sair"
        >
          <LogOut className="h-4 w-4 text-gray-500" />
        </Button>
      </div>
    </header>
  );
}
