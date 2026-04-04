"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  FileText,
  Star,
  UserPlus,
  Calendar,
  Cake,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronLeft,
  Crown,
  Fingerprint,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Classes", href: "/dashboard/classes", icon: GraduationCap },
  { name: "Alunos", href: "/dashboard/alunos", icon: Users },
  { name: "Liderança", href: "/dashboard/lideranca", icon: Crown },
  { name: "Presença", href: "/dashboard/presenca", icon: ClipboardCheck },
  { name: "Justificativas", href: "/dashboard/justificativas", icon: FileText },
  { name: "Lições", href: "/dashboard/licoes", icon: BookOpen },
  { name: "Visitantes", href: "/dashboard/visitantes", icon: UserPlus },
  { name: "Destaques", href: "/dashboard/destaques", icon: Star },
  { name: "Relatórios", href: "/dashboard/relatorios", icon: BarChart3 },
  { name: "Calendário", href: "/dashboard/calendario", icon: Calendar },
  { name: "Aniversariantes", href: "/dashboard/aniversariantes", icon: Cake },
  { name: "Gestão de Acessos", href: "/dashboard/usuarios", icon: Fingerprint },
  { name: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-primary text-white p-2 rounded-lg shadow-lg hover:bg-primary-light transition-colors cursor-pointer"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-sidebar text-white transition-all duration-300 flex flex-col shadow-2xl",
          collapsed ? "w-[72px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className={cn("flex items-center h-20 px-4 border-b border-white/10", collapsed ? "justify-center" : "gap-3")}>
          {!collapsed && (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-20 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg overflow-hidden p-0.5">
                <Image 
                  src="/logo.png" 
                  alt="Logo EBD" 
                  width={80} 
                  height={48} 
                  className="object-contain"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold truncate">EBD com Propósito</h1>
                <p className="text-[10px] text-accent-light truncate font-medium uppercase tracking-wider">Gestão Inteligente</p>
              </div>
            </div>
          )}

          {collapsed && (
            <div className="w-14 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg overflow-hidden p-0.5">
              <Image 
                src="/logo.png" 
                alt="Logo EBD" 
                width={48} 
                height={32} 
                className="object-contain"
              />
            </div>
          )}

          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                  isActive
                    ? "bg-accent/20 text-accent-light border-l-3 border-accent"
                    : "text-gray-300 hover:bg-sidebar-hover hover:text-white",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-accent")} />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center h-12 border-t border-white/10 hover:bg-sidebar-hover transition-colors cursor-pointer"
        >
          <ChevronLeft className={cn("h-5 w-5 transition-transform", collapsed && "rotate-180")} />
        </button>
      </aside>

      {/* Spacer for layout */}
      <div className={cn("hidden lg:block flex-shrink-0 transition-all duration-300", collapsed ? "w-[72px]" : "w-64")} />
    </>
  );
}
