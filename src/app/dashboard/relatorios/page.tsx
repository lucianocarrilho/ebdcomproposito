"use client";

import React, { useState } from "react";
import { BarChart3, Download, FileText, Users, GraduationCap, UserPlus, Cake, Award, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const reportTypes = [
  { id: "aluno", label: "Por Aluno", icon: Users, description: "Frequência individual de cada aluno" },
  { id: "classe", label: "Por Classe", icon: GraduationCap, description: "Dados consolidados por classe" },
  { id: "trimestre", label: "Por Trimestre", icon: BarChart3, description: "Resumo trimestral completo" },
  { id: "visitantes", label: "Visitantes", icon: UserPlus, description: "Relatório de visitantes e convidados" },
  { id: "aniversariantes", label: "Aniversariantes", icon: Cake, description: "Aniversariantes do período" },
  { id: "premiados", label: "Premiados", icon: Award, description: "Alunos destaque e missionários" },
];

const classData = [
  { classe: "Crianças", matriculados: 25, ativos: 22, mediaFreq: 88, faltas: 15, justificadas: 5 },
  { classe: "Adolescentes", matriculados: 18, ativos: 16, mediaFreq: 82, faltas: 20, justificadas: 8 },
  { classe: "Jovens", matriculados: 22, ativos: 20, mediaFreq: 90, faltas: 10, justificadas: 3 },
  { classe: "Homens", matriculados: 20, ativos: 18, mediaFreq: 85, faltas: 18, justificadas: 6 },
  { classe: "Mulheres", matriculados: 15, ativos: 14, mediaFreq: 92, faltas: 8, justificadas: 2 },
];

export default function RelatoriosPage() {
  const [selectedReport, setSelectedReport] = useState("classe");
  const [dateFrom, setDateFrom] = useState("2026-01-01");
  const [dateTo, setDateTo] = useState("2026-03-31");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Relatórios</h1>
        <p className="page-subtitle">Dados e estatísticas da EBD</p>
      </div>

      {/* Report Type Selection */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {reportTypes.map(r => (
          <button
            key={r.id}
            onClick={() => setSelectedReport(r.id)}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              selectedReport === r.id
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <r.icon className={`h-5 w-5 mb-2 ${selectedReport === r.id ? "text-primary" : "text-gray-400"}`} />
            <p className={`text-sm font-medium ${selectedReport === r.id ? "text-primary" : "text-gray-700"}`}>{r.label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 hidden sm:block">{r.description}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Data Início</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Data Fim</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <Select defaultValue="Todas">
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Classe" />
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" /> Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Frequência por Classe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="classe" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="mediaFreq" fill="#1e3a5f" radius={[4, 4, 0, 0]} name="Freq. Média %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo por Classe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {classData.map(c => (
                <div key={c.classe} className="p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">{c.classe}</p>
                    <Badge variant="success">{c.mediaFreq}% freq.</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs text-center">
                    <div>
                      <p className="font-semibold text-gray-900">{c.matriculados}</p>
                      <p className="text-gray-500">Matriculados</p>
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-600">{c.ativos}</p>
                      <p className="text-gray-500">Ativos</p>
                    </div>
                    <div>
                      <p className="font-semibold text-red-600">{c.faltas}</p>
                      <p className="text-gray-500">Faltas</p>
                    </div>
                    <div>
                      <p className="font-semibold text-amber-600">{c.justificadas}</p>
                      <p className="text-gray-500">Justificadas</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-gray-900">100</p>
          <p className="text-xs text-gray-500">Total de Alunos</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-emerald-600">87%</p>
          <p className="text-xs text-gray-500">Frequência Geral</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-red-600">71</p>
          <p className="text-xs text-gray-500">Total de Faltas</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-3xl font-bold text-amber-600">24</p>
          <p className="text-xs text-gray-500">Justificadas</p>
        </div>
      </div>
    </div>
  );
}
