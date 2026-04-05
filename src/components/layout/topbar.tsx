"use client";

import React, { useState, useEffect } from "react";
import { Bell, Search, User, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getGreeting } from "@/lib/utils";
 
const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  DIRIGENTE: "Dirigente",
  VICE_DIRIGENTE: "Vice-Dirigente",
  PROFESSOR: "Professor",
  APOIO: "Apoio/Secretaria",
};
 
export function Topbar() {
  const { data: session } = useSession();
  const [liveImage, setLiveImage] = useState<string | null>(null);
  const userName = session?.user?.name || "Usuário";
  const userRole = (session?.user as Record<string, unknown>)?.role as string || "APOIO";
 
  // Buscar foto atualizada para contornar cache da sessão
  useEffect(() => {
    async function syncUserPhoto() {
      if (session?.user?.email) {
        try {
          const res = await fetch("/api/users");
          const users = await res.json();
          const currentUser = users.find((u: any) => u.email === session?.user?.email);
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
 
  const userImage = liveImage || session?.user?.image;

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
            placeholder="Buscar alunos, classes..."
            className="pl-9 w-64 bg-gray-50 border-gray-200"
          />
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-gray-500" />
        </Button>

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
            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-tighter font-semibold">{roleLabels[userRole] || userRole}</p>
          </div>
        </div>

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
