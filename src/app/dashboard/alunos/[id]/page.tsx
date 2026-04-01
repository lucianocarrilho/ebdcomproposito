"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { 
  ArrowLeft, 
  Phone, 
  MapPin, 
  Calendar, 
  Award, 
  UserPlus, 
  ClipboardCheck,
  Loader2,
  CalendarDays,
  User,
  ShieldCheck,
  MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface StudentDetail {
  id: string;
  name: string;
  gender: string;
  birthDate: string;
  phone: string;
  address: string;
  guardian: string;
  photo?: string;
  active: boolean;
  baptized: boolean;
  member: boolean;
  newConvert: boolean;
  observations: string;
  createdAt: string;
  class?: { name: string };
  stats: {
    totalAulas: number;
    presencas: number;
    faltas: number;
    justificadas: number;
    frequencia: number;
    visitantesTrazidos: number;
    destaques: number;
  };
  attendanceItems: Array<{
    id: string;
    status: string;
    record: { date: string };
  }>;
  visitorsInvited: Array<{
    id: string;
    name: string;
    date: string;
  }>;
}

export default function AlunoDetalhePage() {
  const params = useParams();
  const id = params.id as string;
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStudent() {
      try {
        const response = await fetch(`/api/students/${id}`);
        const data = await response.json();
        setStudent(data);
      } catch (error) {
        console.error("Erro ao buscar detalhes do aluno:", error);
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchStudent();
  }, [id]);

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-4 text-gray-500">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-medium">Carregando perfil do aluno...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 font-medium">Aluno não encontrado.</p>
        <Link href="/dashboard/alunos">
          <Button variant="outline">Voltar para a lista</Button>
        </Link>
      </div>
    );
  }

  // Preparar dados do gráfico (últimas 5 presenças para exemplo ou agregados)
  const frequenciaData = [
    { mes: "Total", presenca: student.stats.presencas, faltas: student.stats.faltas + student.stats.justificadas },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/alunos">
            <Button variant="outline" size="icon" className="shadow-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title text-2xl">{student.name}</h1>
              {!student.active && <Badge variant="destructive">Inativo</Badge>}
            </div>
            <p className="page-subtitle flex items-center gap-2">
              <ShieldCheck className="h-3 w-3 text-primary" />
              Classe: {student.class?.name || "Sem classe"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 sm:flex-none">Editar Perfil</Button>
          <Button className="flex-1 sm:flex-none">Registrar Falta</Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Info */}
        <Card className="lg:col-span-1 shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle className="text-lg">Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-accent rounded-full opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative w-28 h-28 bg-white rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-xl">
                  {student.photo ? (
                    <Image src={student.photo} alt={student.name} fill className="object-cover" />
                  ) : (
                    <User className="h-14 w-14 text-gray-200" />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                  <CalendarDays className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Nascimento</p>
                  <p className="text-sm font-medium">{student.birthDate ? new Date(student.birthDate).toLocaleDateString("pt-BR") : "Não informado"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Telefone</p>
                  <p className="text-sm font-medium">{student.phone || "Não cadastrado"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Endereço</p>
                  <p className="text-sm font-medium line-clamp-1">{student.address || "Não informado"}</p>
                </div>
              </div>
              
              {student.guardian && (
                <div className="flex items-center gap-3 p-2 rounded-lg bg-accent/5 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-accent-dark uppercase tracking-wider font-bold">Responsável</p>
                    <p className="text-sm font-bold">{student.guardian}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
              {student.baptized && <Badge variant="success" className="rounded-full">Batizado</Badge>}
              {student.member && <Badge variant="default" className="rounded-full">Membro</Badge>}
              {student.newConvert && <Badge variant="warning" className="rounded-full">Novo Convertido</Badge>}
            </div>

            {student.observations && (
              <div className="pt-4 border-t border-gray-100 bg-amber-50/30 p-3 rounded-xl border border-amber-100">
                <p className="text-[10px] text-amber-800 uppercase tracking-wider font-extrabold mb-1">Observações Internas</p>
                <p className="text-sm text-gray-600 italic leading-relaxed">&ldquo;{student.observations}&rdquo;</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right - Stats and Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="stat-card text-center bg-emerald-50/50 border-emerald-100 group hover:scale-[1.02] transition-all">
              <ClipboardCheck className="h-6 w-6 text-emerald-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-3xl font-extrabold text-emerald-700">{student.stats.frequencia}%</p>
              <p className="text-[10px] text-emerald-600 uppercase font-bold tracking-widest mt-1">Frequência</p>
            </div>
            <div className="stat-card text-center bg-blue-50/50 border-blue-100 group hover:scale-[1.02] transition-all">
              <Calendar className="h-6 w-6 text-blue-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-3xl font-extrabold text-blue-700">{student.stats.presencas}</p>
              <p className="text-[10px] text-blue-600 uppercase font-bold tracking-widest mt-1">Presenças</p>
            </div>
            <div className="stat-card text-center bg-purple-50/50 border-purple-100 group hover:scale-[1.02] transition-all">
              <UserPlus className="h-6 w-6 text-purple-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-3xl font-extrabold text-purple-700">{student.stats.visitantesTrazidos}</p>
              <p className="text-[10px] text-purple-600 uppercase font-bold tracking-widest mt-1">Visitantes</p>
            </div>
            <div className="stat-card text-center bg-accent-light/10 border-accent-light/20 group hover:scale-[1.02] transition-all">
              <Award className="h-6 w-6 text-accent mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-3xl font-extrabold text-accent-dark">{student.stats.destaques}</p>
              <p className="text-[10px] text-accent font-bold uppercase tracking-widest mt-1">Destaques</p>
            </div>
          </div>

          {/* Last Attendance List */}
          <Card className="shadow-sm border-gray-100">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-emerald-500" />
                Histórico Recente
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-primary">Ver Tudo</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {student.attendanceItems.slice(0, 5).map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        h.status === "PRESENTE" ? "bg-emerald-500" :
                        h.status === "FALTA_JUSTIFICADA" ? "bg-amber-500" : "bg-red-500"
                      )} />
                      <div>
                        <p className="text-sm font-bold text-gray-900">{new Date(h.record.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</p>
                        <p className="text-[10px] text-gray-500 uppercase font-medium tracking-tight">Presença Dominical</p>
                      </div>
                    </div>
                    <Badge
                      className="rounded-full px-3 text-[10px]"
                      variant={
                        h.status === "PRESENTE" ? "success" :
                        h.status === "FALTA_JUSTIFICADA" ? "warning" : "destructive"
                      }
                    >
                      {h.status === "PRESENTE" ? "Presente" : h.status === "FALTA_JUSTIFICADA" ? "Justificada" : "Falta"}
                    </Badge>
                  </div>
                ))}
                {student.attendanceItems.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-sm text-gray-400 italic">Nenhum registro de presença encontrado.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom - Visitors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-500" />
              Visitantes Trazidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {student.visitorsInvited.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-blue-50/30 border border-blue-50 transition-all hover:bg-blue-50/50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <User className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{v.name}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(v.date).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-gray-400">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {student.visitorsInvited.length === 0 && (
                <div className="text-center py-10">
                  <UserPlus className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 italic">Nenhum visitante registrado como indicação.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Integration Note */}
        <Card className="bg-primary/5 border-primary/10 shadow-sm flex flex-col items-center justify-center p-8 text-center italic">
          <Award className="h-12 w-12 text-primary opacity-20 mb-4" />
          <p className="text-sm text-primary-dark font-medium leading-relaxed">
            &ldquo;Tudo o que fizerem, façam de todo o coração, como para o Senhor e não para os homens.&rdquo;
          </p>
          <p className="mt-2 text-xs text-primary/70 font-bold">— Colossenses 3:23</p>
        </Card>
      </div>
    </div>
  );
}

// Utility function for conditional classes
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
