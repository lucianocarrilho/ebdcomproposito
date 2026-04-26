"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
  Bell,
  Info,
  User,
  Camera,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CalendarioPage from "./calendario/page";
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
    totalVisitors: number;
  };
  aniversariantesDoMes: Array<{
    id: string;
    name: string;
    birthDate: string;
    photo?: string;
    class?: { name: string };
  }>;
  recentVisitors: Array<{
    id: string;
    name: string;
    date: string;
    className?: string;
    invitedByName?: string;
    observations?: string;
  }>;
  avisosCalendario: Array<{
    id: string;
    title: string;
    date: string;
    description?: string;
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
  const [recentPhotos, setRecentPhotos] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashRes, photosRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/photos").catch(() => null),
        ]);
        setData(await dashRes.json());
        if (photosRes?.ok) {
          const allPhotos = await photosRes.json();
          // Filtrar apenas álbuns sem classe (Geral) e pegar os 6 mais recentes
          const general = allPhotos
            .filter((a: any) => !a.classId)
            .slice(0, 6);
          setRecentPhotos(general);
        }
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
          Visão geral da Escola Bíblica Dominical • {quarterName} (v1.2)
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
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={false}
                  >
                    {data.pizzaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    iconType="circle"
                    formatter={(value: string, entry: any) => {
                      const item = data.pizzaData.find(d => d.name === value);
                      const total = data.pizzaData.reduce((acc, curr) => acc + curr.value, 0);
                      const percent = total > 0 ? ((item?.value || 0) / total * 100).toFixed(0) : 0;
                      return <span className="text-xs font-bold text-gray-600">{value} ({percent}%)</span>;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* Line Chart - Evolução */}
        <Card className="lg:col-span-2">
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
      </div>

      {/* Fotos da EBD */}
      {recentPhotos.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Fotos da EBD
            </CardTitle>
            <Link href="/dashboard/fotos" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {recentPhotos.map((album: any) => (
                <Link key={album.id} href="/dashboard/fotos" className="group">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                    {album.coverUrl ? (
                      <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="h-8 w-8 text-gray-200" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-[10px] font-bold truncate">{album.title}</p>
                    </div>
                    <Badge className="absolute top-1.5 right-1.5 bg-black/50 text-white text-[9px] font-bold backdrop-blur-sm px-1.5 py-0.5">
                      <Camera className="h-2.5 w-2.5 mr-0.5" /> {album.photoCount}
                    </Badge>
                  </div>
                  <p className="text-[10px] font-medium text-gray-500 mt-1.5 truncate">{album.title}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Avisos Agendados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-indigo-500" />
              Avisos da Agenda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.avisosCalendario?.length > 0 ? (
                data.avisosCalendario.map((aviso) => (
                  <div
                    key={aviso.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all hover:scale-[1.01]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Bell className="h-5 w-5 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{aviso.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-1">{aviso.description || "Sem descrição"}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-white text-indigo-600 border-indigo-100 whitespace-nowrap">
                      {new Date(aviso.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-gray-400">
                  <Bell className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm italic">Nenhum aviso agendado</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Aniversariantes do Mês */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="h-5 w-5 text-pink-500" />
              Aniversariantes de {new Date().toLocaleDateString("pt-BR", { month: "long" }).replace(/^\w/, c => c.toUpperCase())}
              <Badge variant="secondary" className="ml-auto bg-pink-50 text-pink-700 border-pink-100">
                {data.stats.aniversariantes}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.aniversariantesDoMes?.length > 0 ? (
                data.aniversariantesDoMes.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all hover:scale-[1.01]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm bg-pink-100 flex items-center justify-center">
                        {a.photo ? (
                          <Image src={a.photo} alt={a.name} width={40} height={40} className="object-cover" />
                        ) : (
                          <Cake className="h-4 w-4 text-pink-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{a.name}</p>
                        <p className="text-xs text-gray-500">{a.class?.name || "Sem classe"}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-white text-pink-600 border-pink-100 whitespace-nowrap">
                      {new Date(a.birthDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}
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
