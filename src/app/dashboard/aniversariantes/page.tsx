"use client";

import React, { useState } from "react";
import { Cake, Calendar, GraduationCap, Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const aniversariantes = [
  { nome: "Ana Maria Silva", nascimento: "02/04", classe: "Mulheres", idade: 31 },
  { nome: "Carlos Eduardo", nascimento: "05/04", classe: "Homens", idade: 45 },
  { nome: "Isabela Martins", nascimento: "08/04", classe: "Crianças", idade: 11 },
  { nome: "Pedro Costa", nascimento: "12/04", classe: "Adolescentes", idade: 14 },
  { nome: "Juliana Santos", nascimento: "15/04", classe: "Jovens", idade: 24 },
  { nome: "Lucas Ferreira", nascimento: "18/04", classe: "Jovens", idade: 22 },
  { nome: "Roberto Almeida", nascimento: "20/04", classe: "Homens", idade: 38 },
  { nome: "Raquel Oliveira", nascimento: "25/04", classe: "Mulheres", idade: 29 },
  { nome: "Gabriel Santos", nascimento: "28/04", classe: "Crianças", idade: 9 },
  { nome: "Fernanda Lima", nascimento: "30/04", classe: "Jovens", idade: 20 },
];

const hoje = new Date();
const diaHoje = 30;
const semanaFim = diaHoje + 7;

export default function AniversariantesPage() {
  const [filterClass, setFilterClass] = useState("Todas");
  const [filterPeriod, setFilterPeriod] = useState("mes");

  const filtered = aniversariantes.filter(a => {
    const matchClass = filterClass === "Todas" || a.classe === filterClass;
    const day = parseInt(a.nascimento.split("/")[0]);

    let matchPeriod = true;
    if (filterPeriod === "dia") matchPeriod = day === diaHoje;
    if (filterPeriod === "semana") matchPeriod = day >= diaHoje && day <= semanaFim;

    return matchClass && matchPeriod;
  });

  const doDia = aniversariantes.filter(a => parseInt(a.nascimento.split("/")[0]) === diaHoje);
  const daSemana = aniversariantes.filter(a => {
    const d = parseInt(a.nascimento.split("/")[0]);
    return d >= diaHoje && d <= semanaFim;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Aniversariantes</h1>
        <p className="page-subtitle">Abril 2026</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-pink-200 bg-gradient-to-r from-pink-50 to-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
              <Cake className="h-6 w-6 text-pink-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-pink-600">{doDia.length}</p>
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
              <p className="text-2xl font-bold text-purple-600">{daSemana.length}</p>
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
              <p className="text-2xl font-bold text-blue-600">{aniversariantes.length}</p>
              <p className="text-xs text-gray-500">Neste Mês</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dia">Hoje</SelectItem>
            <SelectItem value="semana">Esta Semana</SelectItem>
            <SelectItem value="mes">Este Mês</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas as Classes</SelectItem>
            <SelectItem value="Crianças">Crianças</SelectItem>
            <SelectItem value="Adolescentes">Adolescentes</SelectItem>
            <SelectItem value="Jovens">Jovens</SelectItem>
            <SelectItem value="Homens">Homens</SelectItem>
            <SelectItem value="Mulheres">Mulheres</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Birthday List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cake className="h-5 w-5 text-pink-500" />
            Aniversariantes ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Cake className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Nenhum aniversariante no período selecionado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((a, i) => {
                const isToday = parseInt(a.nascimento.split("/")[0]) === diaHoje;
                return (
                  <div
                    key={a.nome}
                    className={`flex items-center gap-3 p-4 rounded-xl transition-all animate-slide-up ${
                      isToday
                        ? "bg-gradient-to-r from-pink-50 to-amber-50 border-2 border-pink-200 shadow-sm"
                        : "bg-gray-50 hover:bg-gray-100 border border-gray-200"
                    }`}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isToday ? "bg-pink-500" : "bg-primary/10"
                    }`}>
                      {isToday ? (
                        <Cake className="h-5 w-5 text-white" />
                      ) : (
                        <span className="text-sm font-bold text-primary">{a.nascimento.split("/")[0]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{a.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{a.nascimento}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{a.idade} anos</span>
                      </div>
                      <Badge variant="secondary" className="mt-1 text-[10px]">{a.classe}</Badge>
                    </div>
                    {isToday && (
                      <span className="text-lg">🎂</span>
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
