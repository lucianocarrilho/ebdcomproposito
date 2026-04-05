"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  Users,
  UserCheck,
  GraduationCap,
  CalendarCheck,
  UserX,
  FileText,
  Star,
  Cake,
  Crown,
  TrendingUp,
  UserPlus,
  Award,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

interface DashboardData {
  stats: {
    totalStudents: number;
    activeStudents: number;
    totalClasses: number;
    totalLeaders: number;
    presentes: number;
    faltas: number;
    justificadas: number;
    aniversariantes: number;
  };
  aniversariantesDoMes: Array<{
    id: string;
    name: string;
    birthDate: string;
    photo?: string;
    class?: { name: string };
  }>;
  attendanceByClass: Array<{
    classe: string;
    presentes: number;
    faltas: number;
    justificadas: number;
  }>;
  weeklyData: Array<{
    semana: string;
    presenca: number;
    faltas: number;
  }>;
  pizzaData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  destaque?: {
    nome: string;
    classe: string;
    motivo: string;
    foto?: string;
  };
  missionario?: {
    nome: string;
    classe: string;
    motivo: string;
    foto?: string;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/dashboard");
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-4 text-gray-500 animate-fade-in">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-medium">Carregando painel de controle...</p>
      </div>
    );
  }

  if (!data) return null;
 
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const quarter = Math.floor(currentMonth / 3) + 1;
  const quarterName = `${quarter}º Trimestre ${currentYear}`;
 
  const stats = [
    { label: "Total de Alunos", value: data.stats.totalStudents, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Alunos Ativos", value: data.stats.activeStudents, icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Classes", value: data.stats.totalClasses, icon: GraduationCap, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Presença Domingo", value: data.stats.presentes, icon: CalendarCheck, color: "text-primary", bg: "bg-blue-50" },
    { label: "Faltas", value: data.stats.faltas, icon: UserX, color: "text-red-600", bg: "bg-red-50" },
    { label: "Justificadas", value: data.stats.justificadas, icon: FileText, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Professores", value: data.stats.totalLeaders, icon: Crown, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Aniversariantes", value: data.stats.aniversariantes, icon: Cake, color: "text-pink-600", bg: "bg-pink-50" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Visão geral da Escola Bíblica Dominical • {quarterName}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="stat-card animate-slide-up shadow-sm border border-gray-100"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Destaque e Missionário */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.destaque ? (
          <Card className="border-accent/30 bg-gradient-to-r from-amber-50 to-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-5">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <div className="absolute -inset-1 bg-accent/20 rounded-full animate-pulse" />
                  <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md bg-white flex items-center justify-center">
                    {data.destaque.foto ? (
                      <Image src={data.destaque.foto} alt={data.destaque.nome} fill className="object-cover" />
                    ) : (
                      <Star className="h-8 w-8 text-accent" />
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-accent-dark font-bold uppercase tracking-widest bg-accent/10 px-2 py-0.5 rounded-full">Destaque</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900 mt-1">{data.destaque.nome}</p>
                  <p className="text-sm text-gray-500">Classe: {data.destaque.classe} • {data.destaque.motivo}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-gray-200">
            <CardContent className="p-6 flex items-center justify-center text-gray-400 text-sm italic h-[100px]">
              Nenhum aluno destaque registrado este trimestre
            </CardContent>
          </Card>
        )}

        {data.missionario ? (
          <Card className="border-primary/20 bg-gradient-to-r from-blue-50 to-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-5">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <div className="absolute -inset-1 bg-primary/10 rounded-full animate-pulse" />
                  <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md bg-white flex items-center justify-center">
                    {data.missionario.foto ? (
                      <Image src={data.missionario.foto} alt={data.missionario.nome} fill className="object-cover" />
                    ) : (
                      <UserPlus className="h-8 w-8 text-primary" />
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-primary font-bold uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full">Missionário</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900 mt-1">{data.missionario.nome}</p>
                  <p className="text-sm text-gray-500">Classe: {data.missionario.classe} • {data.missionario.motivo}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-gray-200">
            <CardContent className="p-6 flex items-center justify-center text-gray-400 text-sm italic h-[100px]">
              Nenhum aluno missionário registrado este trimestre
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart - Presença por Classe */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-primary" />
              Presença por Classe (Último Domingo)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.attendanceByClass} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="classe" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="presentes" fill="#10b981" radius={[4, 4, 0, 0]} name="Presentes" />
                  <Bar dataKey="faltas" fill="#ef4444" radius={[4, 4, 0, 0]} name="Faltas" />
                  <Bar dataKey="justificadas" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Justificadas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.pizzaData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }: any) =>
                      `${name} ${((percent || 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {data.pizzaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart - Evolução */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolução Semanal de Frequência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="semana" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="presenca"
                    stroke="#1e3a5f"
                    strokeWidth={2.5}
                    dot={{ fill: "#1e3a5f", r: 4 }}
                    name="Presença"
                  />
                  <Line
                    type="monotone"
                    dataKey="faltas"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ fill: "#ef4444", r: 3 }}
                    name="Faltas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Aniversariantes do Mês */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="h-5 w-5 text-pink-500" />
              Aniversariantes do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.aniversariantesDoMes?.length > 0 ? (
                data.aniversariantesDoMes.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all hover:scale-[1.01]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm bg-pink-100 flex items-center justify-center">
                        {a.photo ? (
                          <Image src={a.photo} alt={a.name} width={48} height={48} className="object-cover" />
                        ) : (
                          <Cake className="h-5 w-5 text-pink-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{a.name}</p>
                        <p className="text-xs text-gray-500">{a.class?.name || "Sem classe"}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-white text-pink-600 border-pink-100">
                      {new Date(a.birthDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-gray-400">
                  <Cake className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm italic">Nenhum aniversariante este mês</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
