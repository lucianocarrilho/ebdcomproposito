"use client";

import React, { useState, useEffect } from "react";
import { Plus, Star, Trophy, Award, Loader2, Sparkles, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function DestaquesPage() {
  const [highlights, setHighlights] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchHighlights();
    loadFormOptions();
  }, []);

  const fetchHighlights = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/highlights");
      const json = await res.json();
      setHighlights(json || []);
    } catch (err) {
      toast.error("Erro ao carregar destaques");
    } finally {
      setLoading(false);
    }
  };

  const loadFormOptions = async () => {
    try {
      const [resClasses, resStudents] = await Promise.all([
        fetch("/api/classes"),
        fetch("/api/students")
      ]);
      setClasses(await resClasses.json());
      const studentsJson = await resStudents.json();
      setStudents(studentsJson.students || []);
    } catch (err) {
      console.error("Erro ao carregar opções");
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    
    // Get class for the student if not in form
    const studentId = fd.get("studentId") as string;
    const student = students.find(s => s.id === studentId);

    const payload = {
      studentId: fd.get("studentId"),
      classId: student?.classId || fd.get("classId"),
      quarter: fd.get("quarter"),
      reason: fd.get("reason"),
      type: fd.get("type"),
    };

    try {
      const res = await fetch("/api/highlights", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Destaque registrado com sucesso!");
        setIsDialogOpen(false);
        fetchHighlights();
      } else {
        throw new Error();
      }
    } catch (err) {
      toast.error("Erro ao registrar destaque");
    } finally {
      setSubmitting(false);
    }
  };

  // Find most recent for cards
  const latestDestaque = highlights.find(h => h.type === "destaque");
  const latestMissionario = highlights.find(h => h.type === "missionario");

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Mural de Honra</h1>
          <p className="page-subtitle">Reconhecendo a dedicação dos nossos alunos</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="premium-button">
          <Plus className="h-4 w-4 mr-2" /> Novo Destaque
        </Button>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-gray-500">Buscando medalhistas...</p>
        </div>
      ) : (
        <>
          {/* Current highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-none shadow-premium bg-gradient-to-br from-amber-500/10 via-white to-white overflow-hidden relative">
               <div className="absolute right-0 top-0 p-4 opacity-5 pointer-events-none">
                <Star className="h-32 w-32 rotate-12" />
              </div>
              <CardContent className="p-6 relative z-10">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-amber-100 flex items-center justify-center border-2 border-amber-200">
                    {latestDestaque?.student?.photo ? (
                      <img src={latestDestaque.student.photo} className="h-full w-full object-cover" alt="" />
                    ) : (
                      <Sparkles className="h-8 w-8 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <Badge variant="warning" className="uppercase text-[10px] tracking-widest font-bold mb-1">
                      ⭐ Aluno Destaque
                    </Badge>
                    <p className="text-xl font-extrabold text-gray-900 mt-1">{latestDestaque?.student?.name || "A definir"}</p>
                    <p className="text-sm text-gray-500 font-medium">Classe: {latestDestaque?.class?.name || "—"}</p>
                    {latestDestaque && (
                      <>
                        <p className="text-sm text-gray-600 mt-3 italic leading-relaxed">&ldquo;{latestDestaque.reason}&rdquo;</p>
                        <div className="mt-3 flex items-center gap-1 text-amber-600">
                          <Calendar className="h-3 w-3" />
                          <span className="text-[10px] font-bold uppercase">{latestDestaque.quarter}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-premium bg-gradient-to-br from-primary/10 via-white to-white overflow-hidden relative">
               <div className="absolute right-0 top-0 p-4 opacity-5 pointer-events-none">
                <Trophy className="h-32 w-32 -rotate-12" />
              </div>
              <CardContent className="p-6 relative z-10">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-blue-100 flex items-center justify-center border-2 border-blue-200">
                    {latestMissionario?.student?.photo ? (
                      <img src={latestMissionario.student.photo} className="h-full w-full object-cover" alt="" />
                    ) : (
                      <Trophy className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  <div>
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none uppercase text-[10px] tracking-widest font-bold mb-1">
                      🏆 Aluno Missionário
                    </Badge>
                    <p className="text-xl font-extrabold text-gray-900 mt-1">{latestMissionario?.student?.name || "A definir"}</p>
                    <p className="text-sm text-gray-500 font-medium">Classe: {latestMissionario?.class?.name || "—"}</p>
                    {latestMissionario && (
                      <>
                        <p className="text-sm text-gray-600 mt-3 italic leading-relaxed">&ldquo;{latestMissionario.reason}&rdquo;</p>
                        <div className="mt-3 flex items-center gap-1 text-primary">
                          <Calendar className="h-3 w-3" />
                          <span className="text-[10px] font-bold uppercase">{latestMissionario.quarter}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* History */}
          <Card className="border-none shadow-premium">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="h-5 w-5 text-accent" />
                Histórico de Reconhecimentos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-50">
                {highlights.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-5 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                        d.type === "destaque" ? "bg-amber-50 text-amber-500" : "bg-blue-50 text-primary"
                      }`}>
                        {d.type === "destaque" ? <Star className="h-6 w-6" /> : <Trophy className="h-6 w-6" />}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{d.student?.name}</p>
                        <p className="text-xs text-gray-500 font-medium">{d.class?.name} • {new Date(d.date).toLocaleDateString("pt-BR")}</p>
                        <p className="text-sm text-gray-600 italic mt-1">&ldquo;{d.reason}&rdquo;</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                       <Badge variant={d.type === "destaque" ? "warning" : "default"}>
                        {d.type === "destaque" ? "Destaque" : "Missionário"}
                      </Badge>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{d.quarter}</span>
                    </div>
                  </div>
                ))}
                {highlights.length === 0 && (
                   <div className="p-10 text-center text-gray-400 italic">
                    Nenhum destaque registrado no histórico.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">Novo Reconhecimento</DialogTitle>
            <DialogDescription>Premiar um aluno exemplar ou missionário</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label htmlFor="studentId" className="font-bold">Qual Aluno?</Label>
              <Select name="studentId" required>
                <SelectTrigger className="h-11 rounded-lg">
                  <SelectValue placeholder="Selecione o aluno" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.class?.name})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type" className="font-bold">Categoria</Label>
                <Select name="type" defaultValue="destaque">
                  <SelectTrigger className="h-11 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="destaque">⭐ Aluno Destaque</SelectItem>
                    <SelectItem value="missionario">🏆 Aluno Missionário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quarter" className="font-bold">Trimestre</Label>
                <Input id="quarter" name="quarter" required defaultValue="1º Trimestre 2026" className="h-11 rounded-lg" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="font-bold">Motivo do Reconhecimento</Label>
              <Textarea id="reason" name="reason" required className="rounded-lg resize-none min-h-[100px]" placeholder="Ex: Participativo em todas as lições e trouxe 5 novos convidados..." />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
               <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={submitting}>Cancelar</Button>
               <Button type="submit" disabled={submitting} className="premium-button min-w-[120px]">
                 {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Consagrar Aluno"}
               </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
