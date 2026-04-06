"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, MessageSquare, Cake, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function NotificationTray() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        
        // Se o número de notificações aumentou, toca o som!
        if (data.length > notifications.length && notifications.length > 0) {
          playAlertSound();
        }
        
        setNotifications(data);
        setUnreadCount(data.filter((n: any) => !n.isRead).length);
      }
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
    }
  };

  const playAlertSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log("Som bloqueado pelo navegador até o primeiro clique:", e));
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Verifica a cada 1 minuto
    return () => clearInterval(interval);
  }, [notifications.length]);

  const markAsRead = async (id: string) => {
    if (id.startsWith("bday-")) return; // Birthdays are dynamic

    try {
      await fetch(`/api/notifications/read?id=${id}`, { method: "POST" });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "birthday": return <Cake className="h-4 w-4 text-pink-500" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "success": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      default: return <MessageSquare className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative">
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-gray-100 transition-colors">
            <Bell className={`h-5 w-5 text-gray-500 ${unreadCount > 0 ? 'animate-bounce-short' : ''}`} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] items-center justify-center text-white font-bold">
                  {unreadCount}
                </span>
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[320px] sm:w-80 p-0 shadow-2xl border border-gray-200 bg-white rounded-2xl animate-in zoom-in-95 duration-200 z-50">
          <div className="p-4 border-b bg-gray-50/80 rounded-t-2xl">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
              <Bell className="h-4 w-4 text-primary" />
              Notificações
            </h3>
          </div>
          
          <div className="max-h-[350px] overflow-y-auto scrollbar-hide">
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`p-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer ${!n.isRead ? 'bg-blue-50/30' : ''}`}
                  onClick={() => markAsRead(n.id)}
                >
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0 border border-gray-100">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-900 mb-0.5">{n.title}</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.isRead && !n.isBirthday && (
                      <div className="h-2 w-2 rounded-full bg-primary mt-1 shadow-sm shadow-primary/20"></div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400 italic text-sm">
                Nenhum aviso no momento.
              </div>
            )}
          </div>
          
          {notifications.length > 0 && (
            <div className="p-3 bg-gray-50/50 text-center rounded-b-2xl border-t">
              <button className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider">
                Ver Tudo
              </button>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
