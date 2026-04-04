"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, BookOpen, Cake, Star, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const typeConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  aula: { color: "bg-blue-500", icon: BookOpen, label: "Aula" },
  evento: { color: "bg-emerald-500", icon: Star, label: "Evento" },
  comemorativo: { color: "bg-pink-500", icon: Star, label: "Festa" },
  aniversario: { color: "bg-amber-500", icon: Cake, label: "Aniversário" },
  trimestre: { color: "bg-purple-500", icon: CalendarIcon, label: "Trimestre" },
};

export default function CalendarioPage() {
  const { data: session } = useSession();
  const [currentMonth, setCurrentMonth] = useState(new Date().getUTCMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getUTCFullYear());
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [currentMonth, currentYear]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events?month=${currentMonth}&year=${currentYear}`);
      const json = await res.json();
      setEvents(json || []);
    } catch (err) {
      toast.error("Erro ao carregar calendário");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    
    const payload = {
      title: fd.get("title"),
      date: fd.get("date"),
      type: fd.get("type"),
      description: fd.get("description"),
    };

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Evento agendado!");
        setIsDialogOpen(false);
        fetchEvents();
      } else {
        throw new Error();
      }
    } catch (err) {
      toast.error("Erro ao agendar evento");
    } finally {
      setSubmitting(false);
    }
  };

  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-extrabold text-gray-900">Agenda da EBD</h1>
          <p className="page-subtitle text-gray-500">Aulas, eventos e aniversariantes de {months[currentMonth]}</p>
        </div>
        {(session?.user as any)?.role === "ADMIN" && (
          <Button onClick={() => setIsDialogOpen(true)} className="premium-button">
            <Plus className="h-4 w-4 mr-2" /> Agendar Evento
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-3 border-none shadow-premium overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-full border-gray-200">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-xl font-extrabold min-w-[150px] text-center">
                  {months[currentMonth]} {currentYear}
                </CardTitle>
                <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8 rounded-full border-gray-200">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => {
                const now = new Date();
                setCurrentMonth(now.getUTCMonth());
                setCurrentYear(now.getUTCFullYear());
              }} className="text-primary font-bold">Hoje</Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="h-96 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm text-gray-500">Sincronizando agenda...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 mb-2">
                  {weekDays.map(d => (
                    <div key={d} className="text-center text-[10px] uppercase tracking-widest font-bold text-gray-400 py-2">{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 md:gap-3">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square md:h-24 bg-gray-50/30 rounded-xl" />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const dayEvents = events.filter(e => new Date(e.date).getUTCDate() === day);
                    const isToday = day === new Date().getDate() && currentMonth === new Date().getUTCMonth() && currentYear === new Date().getUTCFullYear();
                    
                    return (
                      <div
                        key={day}
                        className={`aspect-square md:h-24 rounded-xl p-2 md:p-3 text-sm border transition-all duration-300 relative group hover:shadow-md ${
                          isToday ? "bg-primary/5 border-primary shadow-inner" : "border-gray-100 hover:bg-gray-50 hover:border-gray-200"
                        }`}
                      >
                        <span className={`text-xs font-extrabold ${isToday ? "text-primary" : "text-gray-400 group-hover:text-gray-900"}`}>{day}</span>
                        <div className="mt-1 space-y-1">
                          {dayEvents.slice(0, 2).map((e, idx) => (
                            <div
                              key={e.id}
                              className={`text-[8px] md:text-[9px] text-white font-bold rounded-md px-1.5 py-0.5 md:py-1 truncate shadow-sm ${typeConfig[e.type]?.color || "bg-gray-400"}`}
                              title={e.title}
                            >
                              {e.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <p className="text-[8px] text-gray-400 font-bold ml-1">+{dayEvents.length - 2}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Events List Side */}
        <div className="space-y-6">
          <Card className="border-none shadow-premium h-fit">
            <CardHeader className="bg-white border-b border-gray-50">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Destaques do Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {events.length === 0 && !loading ? (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Info className="h-6 w-6 text-gray-300" />
                    </div>
                    <p className="text-xs text-gray-400 italic">Nenhum evento programado para este mês.</p>
                  </div>
                ) : (
                  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((e) => {
                    const config = typeConfig[e.type];
                    const Icon = config?.icon || Star;
                    return (
                      <div key={e.id} className="group flex items-start gap-4 p-3 rounded-2xl bg-gray-50 border border-transparent hover:bg-white hover:border-gray-100 hover:shadow-md transition-all duration-300">
                        <div className={`w-10 h-10 ${config?.color || "bg-gray-400"} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transform group-hover:scale-110 transition-transform`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">{e.title}</p>
                          <p className="text-[11px] text-gray-400 font-bold flex items-center gap-1 uppercase">
                            <span className="text-primary">{new Date(e.date).getUTCDate()} de {months[currentMonth]}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Legend */}
              <div className="mt-8 pt-4 border-t border-gray-50">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Legenda</p>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(typeConfig).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-xs font-bold text-gray-600">
                      <div className={`w-3 h-3 rounded-full ${val.color} shadow-sm`} />
                      {val.label}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New Event Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-gray-900">Agendar Atividade</DialogTitle>
            <DialogDescription>Crie um novo evento no calendário</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="font-bold">Título do Evento</Label>
              <Input id="title" name="title" required className="h-11 rounded-lg" placeholder="Ex: Reunião de Professores" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="font-bold">Data</Label>
                <Input id="date" name="date" type="date" required className="h-11 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type" className="font-bold">Tipo</Label>
                <Select name="type" defaultValue="evento">
                  <SelectTrigger className="h-11 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aula">📖 Aula EBD</SelectItem>
                    <SelectItem value="evento">⭐ Evento Geral</SelectItem>
                    <SelectItem value="comemorativo">🎉 Festa/Comemorativo</SelectItem>
                    <SelectItem value="trimestre">📅 Trimestre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="font-bold">Descrição (Opcional)</Label>
              <Input id="description" name="description" className="h-11 rounded-lg" placeholder="Mais detalhes..." />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
               <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={submitting}>Cancelar</Button>
               <Button type="submit" disabled={submitting} className="premium-button min-w-[120px]">
                 {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agendar"}
               </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
