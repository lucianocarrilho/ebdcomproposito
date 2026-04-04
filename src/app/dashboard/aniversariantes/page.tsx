"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Cake, Calendar, GraduationCap, Gift, Loader2, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSession } from "next-auth/react";

interface Aniversariante {
  id: string;
  nome: string;
  nascimento: string;
  classe: string;
  idade: number;
  photo?: string;
  dia: number;
}

export default function AniversariantesPage() {
  const { data: session } = useSession();
  const [birthdays, setBirthdays] = useState<Aniversariante[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState("Todas");
  const [filterPeriod, setFilterPeriod] = useState("mes");
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);

  const fetchBirthdays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/students/birthdays", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setBirthdays(data);
      }
    } catch (error) {
      console.error("Erro ao buscar aniversariantes:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/classes");
      if (res.ok) {
        const data = await res.json();
        setAvailableClasses(data);
      }
    } catch (error) {
      console.error("Erro ao buscar classes:", error);
    }
  }, []);

  useEffect(() => {
    fetchBirthdays();
    fetchClasses();
  }, [fetchBirthdays, fetchClasses]);

  const diaHoje = new Date().getDate();
  const semanaFim = diaHoje + 7;

  const filtered = birthdays.filter(a => {
    const matchClass = filterClass === "Todas" || a.classe === filterClass;
    
    let matchPeriod = true;
    if (filterPeriod === "dia") matchPeriod = a.dia === diaHoje;
    if (filterPeriod === "semana") matchPeriod = a.dia >= diaHoje && a.dia <= semanaFim;

    return matchClass && matchPeriod;
  });

  const doDia = birthdays.filter(a => a.dia === diaHoje);
  const daSemana = birthdays.filter(a => a.dia >= diaHoje && a.dia <= semanaFim);

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const currentMonthName = monthNames[new Date().getMonth()];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Aniversariantes</h1>
        <p className="page-subtitle">{currentMonthName} {new Date().getFullYear()}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-pink-200 bg-gradient-to-r from-pink-50 to-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
              <Cake className="h-6 w-6 text-pink-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-pink-600">{loading ? "..." : doDia.length}</p>
              <p className="text-xs text-gray-500">Aniversariantes Hoje</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Calendar className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{loading ? "..." : daSemana.length}</p>
              <p className="text-xs text-gray-500">Esta Semana</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Gift className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{loading ? "..." : birthdays.length}</p>
              <p className="text-xs text-gray-500">Neste Mês</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-48 bg-white rounded-xl">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dia">Hoje</SelectItem>
            <SelectItem value="semana">Esta Semana</SelectItem>
            <SelectItem value="mes">Este Mês</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-48 bg-white rounded-xl">
            <SelectValue placeholder="Todas as Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas as Classes</SelectItem>
            {availableClasses.map(cls => (
              <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Birthday List */}
      <Card className="border-none shadow-sm overflow-hidden rounded-3xl">
        <CardHeader className="bg-white border-b border-gray-50">
          <CardTitle className="flex items-center gap-2">
            <Cake className="h-5 w-5 text-pink-500" />
            Aniversariantes ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 bg-white">
          {loading ? (
            <div className="text-center py-12 text-gray-400">
              <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-primary" />
              <p>Buscando aniversariantes reais...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Cake className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Nenhum aniversariante no período selecionado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((a, i) => {
                const isToday = a.dia === diaHoje;
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-4 p-5 rounded-2xl transition-all animate-slide-up ${
                      isToday
                        ? "bg-gradient-to-r from-pink-50/50 to-amber-50/50 border-2 border-pink-200 shadow-md ring-1 ring-pink-100"
                        : "bg-white hover:bg-gray-50 border border-gray-100 shadow-sm"
                    }`}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 shadow-inner ${
                      isToday ? "bg-pink-500 ring-4 ring-pink-100" : "bg-primary/5"
                    }`}>
                      {isToday ? (
                        <Cake className="h-6 w-6 text-white" />
                      ) : (
                        <span className="text-lg font-black text-primary">{a.dia}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate leading-tight">{a.nome}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-semibold text-gray-400">{a.nascimento}</span>
                        <span className="text-xs text-gray-300">•</span>
                        <span className="text-xs font-medium text-gray-500">{a.idade} anos</span>
                      </div>
                      <Badge variant="secondary" className="mt-2 text-[10px] bg-gray-100 text-gray-600 border-none px-2 rounded-lg">
                        <GraduationCap className="h-3 w-3 mr-1" />
                        {a.classe}
                      </Badge>
                    </div>
                    {isToday && (
                      <div className="bg-pink-100 w-10 h-10 rounded-full flex items-center justify-center animate-bounce text-xl">
                        🎂
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
