"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, BookOpen, Cake, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface CalendarEvent {
  date: number;
  month: number;
  year: number;
  title: string;
  type: "aula" | "evento" | "comemorativo" | "aniversario" | "trimestre";
}

const events: CalendarEvent[] = [
  { date: 5, month: 0, year: 2026, title: "EBD - Lição 1", type: "aula" },
  { date: 12, month: 0, year: 2026, title: "EBD - Lição 2", type: "aula" },
  { date: 19, month: 0, year: 2026, title: "EBD - Lição 3", type: "aula" },
  { date: 26, month: 0, year: 2026, title: "EBD - Lição 4", type: "aula" },
  { date: 2, month: 1, year: 2026, title: "EBD - Lição 5", type: "aula" },
  { date: 9, month: 1, year: 2026, title: "EBD - Lição 6", type: "aula" },
  { date: 16, month: 1, year: 2026, title: "EBD - Lição 7", type: "aula" },
  { date: 23, month: 1, year: 2026, title: "EBD - Lição 8", type: "aula" },
  { date: 2, month: 2, year: 2026, title: "EBD - Lição 9", type: "aula" },
  { date: 9, month: 2, year: 2026, title: "EBD - Lição 10", type: "aula" },
  { date: 16, month: 2, year: 2026, title: "EBD - Lição 11", type: "aula" },
  { date: 23, month: 2, year: 2026, title: "EBD - Lição 12", type: "aula" },
  { date: 30, month: 2, year: 2026, title: "EBD - Lição 13 (encerramento)", type: "aula" },
  { date: 1, month: 0, year: 2026, title: "Início do 1º Trimestre", type: "trimestre" },
  { date: 31, month: 2, year: 2026, title: "Fim do 1º Trimestre", type: "trimestre" },
  { date: 2, month: 3, year: 2026, title: "Aniversário - Ana Maria", type: "aniversario" },
  { date: 8, month: 3, year: 2026, title: "Aniversário - Carlos Silva", type: "aniversario" },
  { date: 12, month: 3, year: 2026, title: "Dia das Crianças", type: "comemorativo" },
  { date: 10, month: 4, year: 2026, title: "Dia das Mães", type: "comemorativo" },
];

const typeConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  aula: { color: "bg-primary", icon: BookOpen, label: "Aula" },
  evento: { color: "bg-emerald-500", icon: Star, label: "Evento" },
  comemorativo: { color: "bg-pink-500", icon: Star, label: "Comemorativo" },
  aniversario: { color: "bg-amber-500", icon: Cake, label: "Aniversário" },
  trimestre: { color: "bg-purple-500", icon: CalendarIcon, label: "Trimestre" },
};

export default function CalendarioPage() {
  const [currentMonth, setCurrentMonth] = useState(2); // March
  const [currentYear, setCurrentYear] = useState(2026);

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

  const monthEvents = events.filter(e => e.month === currentMonth && e.year === currentYear);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Calendário</h1>
        <p className="page-subtitle">Aulas, eventos e datas importantes da EBD</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle>{months[currentMonth]} {currentYear}</CardTitle>
              <Button variant="ghost" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Week days header */}
            <div className="grid grid-cols-7 mb-2">
              {weekDays.map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-20" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dayEvents = monthEvents.filter(e => e.date === day);
                const isToday = day === 30 && currentMonth === 2 && currentYear === 2026;
                return (
                  <div
                    key={day}
                    className={`h-20 rounded-lg p-1 text-sm border transition-colors ${
                      isToday ? "bg-primary/5 border-primary" : "border-gray-100 hover:bg-gray-50"
                    }`}
                  >
                    <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-gray-700"}`}>{day}</span>
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 2).map((e, i) => (
                        <div
                          key={i}
                          className={`text-[9px] text-white rounded px-1 py-0.5 truncate ${typeConfig[e.type]?.color}`}
                        >
                          {e.title.length > 15 ? e.title.slice(0, 15) + "…" : e.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <p className="text-[9px] text-gray-500">+{dayEvents.length - 2} mais</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Events List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eventos do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {monthEvents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Nenhum evento neste mês</p>
              ) : (
                monthEvents.sort((a, b) => a.date - b.date).map((e, i) => {
                  const config = typeConfig[e.type];
                  const Icon = config.icon;
                  return (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition">
                      <div className={`w-8 h-8 ${config.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{e.title}</p>
                        <p className="text-xs text-gray-500">
                          {String(e.date).padStart(2, "0")}/{String(e.month + 1).padStart(2, "0")}/{e.year}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t">
              <p className="text-xs font-medium text-gray-500 mb-2">Legenda</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(typeConfig).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 text-xs text-gray-600">
                    <div className={`w-3 h-3 rounded ${val.color}`} />
                    {val.label}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
