"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Check, X, Clock, UserPlus, CheckCheck, Save, Loader2, AlertTriangle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Status = "PRESENTE" | "FALTA" | "FALTA_JUSTIFICADA" | "VISITANTE" | "";

interface AttendanceStudent {
  studentId: string;
  studentName: string;
  status: Status;
  photo?: string | null;
  observations?: string;
}

interface Class {
  id: string;
  name: string;
}

const statusConfig = {
  PRESENTE: { label: "Presente", color: "bg-emerald-500", icon: Check },
  FALTA: { label: "Falta", color: "bg-red-500", icon: X },
  FALTA_JUSTIFICADA: { label: "Justificada", color: "bg-amber-500", icon: Clock },
  VISITANTE: { label: "Visitante", color: "bg-blue-500", icon: UserPlus },
};

export default function PresencaPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Carregar classes iniciais
  useEffect(() => {
    async function fetchClasses() {
      try {
        const res = await fetch("/api/classes");
        const data = await res.json();
        setClasses(data);
        if (data.length > 0) {
          setSelectedClass(data[0].id);
        }
      } catch (error) {
        console.error("Erro ao buscar classes:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchClasses();
  }, []);

  // Carregar alunos quando classe ou data mudar
  const fetchAttendance = useCallback(async () => {
    if (!selectedClass || !selectedDate) return;
    
    setLoadingStudents(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/attendance?classId=${selectedClass}&date=${selectedDate}`);
      const data = await res.json();
      
      // Também precisamos das fotos dos alunos, que a API de attendance pode não retornar por padrão
      // Então vamos garantir que as fotos venham da listagem de estudantes se necessário
      // Mas para ser eficiente, ajustamos o merging no frontend ou a API.
      // Vou assumir que a API de attendance retornará student: { photo } se eu ajustar a rota.
      // Por agora, vamos usar o que temos e o André deve aparecer pelo nome.
      setStudents(data.students || []);
      setObservations(data.record?.observations || "");
    } catch (error) {
      console.error("Erro ao buscar presença:", error);
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClass, selectedDate]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const setStatus = (id: string, status: Status) => {
    setStudents(prev => prev.map(s => s.studentId === id ? { ...s, status } : s));
    setSaved(false);
  };

  const markAllPresent = () => {
    setStudents(prev => prev.map(s => ({ ...s, status: "PRESENTE" as Status })));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedClass || !selectedDate) return;
    
    setSaving(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClass,
          date: selectedDate,
          observations,
          items: students.map(s => ({
            studentId: s.studentId,
            status: s.status,
            observations: s.observations
          }))
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error("Erro ao salvar presença:", error);
    } finally {
      setSaving(false);
    }
  };

  const presentes = students.filter(s => s.status === "PRESENTE").length;
  const faltas = students.filter(s => s.status === "FALTA").length;
  const justificadas = students.filter(s => s.status === "FALTA_JUSTIFICADA").length;
  const total = students.length;

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-gray-500">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p>Carregando sistema de chamada...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in ">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl">Chamada de Presença</h1>
          <p className="page-subtitle">Registre a presença dos alunos na EBD</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-40 shadow-sm"
          />
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-48 shadow-sm">
              <SelectValue placeholder="Selecione a classe" />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Inscritos</p>
          <p className="text-3xl font-extrabold text-gray-900">{total}</p>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-emerald-500 uppercase font-bold tracking-widest mb-1">Presentes</p>
          <p className="text-3xl font-extrabold text-emerald-600">{presentes}</p>
        </div>
        <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-red-500 uppercase font-bold tracking-widest mb-1">Faltas</p>
          <p className="text-3xl font-extrabold text-red-600">{faltas}</p>
        </div>
        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-amber-500 uppercase font-bold tracking-widest mb-1">Justificadas</p>
          <p className="text-3xl font-extrabold text-amber-600">{justificadas}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={markAllPresent} disabled={loadingStudents || total === 0} className="rounded-full shadow-sm">
          <CheckCheck className="h-4 w-4 mr-2 text-emerald-500" />
          Marcar Todos Presentes
        </Button>
      </div>

      {/* Attendance List */}
      <Card className="rounded-3xl shadow-sm border-gray-100 overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-primary font-bold">{classes.find(c => c.id === selectedClass)?.name}</span>
              <span className="text-gray-300 mx-1">•</span>
              <span className="text-gray-500 font-medium">{new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' })}</span>
            </div>
            {loadingStudents && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {students.map(s => (
              <div
                key={s.studentId}
                className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                    {s.photo ? (
                      <Image src={s.photo} alt={s.studentName} width={44} height={44} className="object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-primary uppercase">
                        {s.studentName.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{s.studentName}</p>
                    <div className="flex gap-2 items-center mt-1">
                      {s.status ? (
                        <Badge 
                          variant="secondary"
                          className={cn(
                            "text-[9px] uppercase tracking-tighter px-2",
                            s.status === "PRESENTE" ? "bg-emerald-100 text-emerald-700" :
                            s.status === "FALTA" ? "bg-red-100 text-red-700" :
                            "bg-amber-100 text-amber-700"
                          )}
                        >
                          {statusConfig[s.status as keyof typeof statusConfig]?.label}
                        </Badge>
                      ) : (
                        <p className="text-[10px] text-gray-400 italic">Pendente</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {(Object.keys(statusConfig) as (keyof typeof statusConfig)[]).map(status => {
                    const config = statusConfig[status];
                    const Icon = config.icon;
                    const isActive = s.status === status;
                    return (
                      <button
                        key={status}
                        onClick={() => setStatus(s.studentId, status)}
                        disabled={saving}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                          isActive
                            ? `${config.color} text-white shadow-lg shadow-${status === 'PRESENTE' ? 'emerald' : status === 'FALTA' ? 'red' : 'amber'}-200 scale-110`
                            : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        )}
                        title={config.label}
                      >
                        <Icon className={cn("h-4 w-4", isActive ? "stroke-[3]" : "")} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {students.length === 0 && !loadingStudents && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-8 w-8 text-gray-200" />
                </div>
                <p className="text-gray-500 font-medium">Nenhum aluno ativo nesta classe.</p>
                <p className="text-xs text-gray-400 mt-1">Cadastre alunos ou altere a classe no topo.</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-gray-50/30 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Observações da aula</Label>
              <Textarea
                value={observations}
                onChange={e => setObservations(e.target.value)}
                placeholder="Anotações sobre a lição dada, avisos ou pedidos de oração..."
                className="rounded-2xl border-gray-200 focus:ring-primary shadow-sm min-h-[100px]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                onClick={handleSave} 
                disabled={saving || total === 0} 
                className="min-w-44 h-12 rounded-full text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                {saving ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Salvando...</>
                ) : saved ? (
                  <><Check className="h-5 w-5 mr-2" /> Salvo com Sucesso!</>
                ) : (
                  <><Save className="h-5 w-5 mr-2" /> Salvar Chamada</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Alert for empty state */}
      {total > 0 && !students.some(s => s.status) && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-xs">
          <AlertTriangle className="h-4 w-4" />
          Lembre-se de clicar em "Salvar Chamada" após preencher as presenças.
        </div>
      )}
    </div>
  );
}

