"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, Star, Trophy, Award, Loader2, Sparkles, Calendar, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

// Gerar lista de trimestres (mesmo padrão do Dashboard)
function getQuarters() {
  const year = new Date().getFullYear();
  const quarters = [];
  for (let y = year - 1; y <= year + 1; y++) {
    for (let q = 1; q <= 4; q++) {
      quarters.push({
        value: `${y}-Q${q}`,
        label: `${q}º Trimestre ${y}`,
      });
    }
  }
  return quarters;
}

// Converter "2026-Q2" → "2º Trimestre 2026"
function quarterToLabel(q: string) {
  const match = q.match(/^(\d{4})-Q(\d)$/);
  if (match) return `${match[2]}º Trimestre ${match[1]}`;
  return q;
}

// Determinar o trimestre atual no formato do sistema
function getCurrentQuarter() {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

export default function DestaquesPage() {
  const [highlights, setHighlights] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [editingHighlight, setEditingHighlight] = useState<any>(null);
  const [deletingHighlight, setDeletingHighlight] = useState<any>(null);

  // Form controlled state for editing
  const [formStudentId, setFormStudentId] = useState("");
  const [formType, setFormType] = useState("destaque");
  const [formQuarter, setFormQuarter] = useState("");
  const [formReason, setFormReason] = useState("");

  const loadedRef = useRef(false);
  const quarters = getQuarters();

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      // Load current quarter from settings like Dashboard does
      fetch("/api/dashboard")
        .then(res => res.json())
        .then(data => {
          const q = data.currentQuarter || getCurrentQuarter();
          setSelectedQuarter(q);
        })
        .catch(() => {
          setSelectedQuarter(getCurrentQuarter());
        });
      loadFormOptions();
    }
  }, []);

  useEffect(() => {
    if (selectedQuarter) {
      fetchHighlights(selectedQuarter);
    }
  }, [selectedQuarter]);

  const fetchHighlights = async (quarter: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/highlights?quarter=${quarter}`);
      const json = await res.json();
      setHighlights(Array.isArray(json) ? json : []);
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
      setStudents(Array.isArray(studentsJson) ? studentsJson : (studentsJson.students || []));
    } catch (err) {
      console.error("Erro ao carregar opções");
    }
  };

  const openNewDialog = () => {
    setEditingHighlight(null);
    setFormStudentId("");
    setFormType("destaque");
    setFormQuarter(selectedQuarter);
    setFormReason("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (highlight: any) => {
    setEditingHighlight(highlight);
    setFormStudentId(highlight.studentId);
    setFormType(highlight.type);
    // Try to find the matching quarter value
    const matchingQuarter = quarters.find(q => 
      q.value === highlight.quarter || q.label === highlight.quarter
    );
    setFormQuarter(matchingQuarter?.value || selectedQuarter);
    setFormReason(highlight.reason);
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (highlight: any) => {
    setDeletingHighlight(highlight);
    setIsDeleteDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const student = students.find(s => s.id === formStudentId);
    const quarterLabel = quarterToLabel(formQuarter);

    const payload = {
      studentId: formStudentId,
      classId: student?.classId || student?.class?.id,
      quarter: quarterLabel,
      reason: formReason,
      type: formType,
    };

    try {
      const url = editingHighlight
        ? `/api/highlights/${editingHighlight.id}`
        : "/api/highlights";
      const method = editingHighlight ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingHighlight 
          ? "Destaque atualizado com sucesso!" 
          : "Destaque registrado com sucesso!"
        );
        setIsDialogOpen(false);
        setEditingHighlight(null);
        fetchHighlights(selectedQuarter);
      } else {
        throw new Error();
      }
    } catch (err) {
      toast.error("Erro ao salvar destaque");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingHighlight) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/highlights/${deletingHighlight.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Destaque excluído com sucesso!");
        setIsDeleteDialogOpen(false);
        setDeletingHighlight(null);
        fetchHighlights(selectedQuarter);
      } else {
        throw new Error();
      }
    } catch (err) {
      toast.error("Erro ao excluir destaque");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedQuarterLabel = quarters.find(q => q.value === selectedQuarter)?.label || selectedQuarter;

  // Find most recent for cards (filtered by quarter)
  const latestDestaque = highlights.find(h => h.type === "destaque");
  const latestMissionario = highlights.find(h => h.type === "missionario");

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Mural de Honra</h1>
          <p className="page-subtitle">Reconhecendo a dedicação dos nossos alunos • {selectedQuarterLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border shadow-sm">
            <Label htmlFor="quarterSelect" className="text-xs font-bold text-gray-400 pl-2 whitespace-nowrap">FILTRAR POR TRIMESTRE:</Label>
            <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
              <SelectTrigger id="quarterSelect" className="border-none bg-transparent font-bold text-primary focus:ring-0 w-44">
                <SelectValue placeholder="Selecione o Trimestre" />
              </SelectTrigger>
              <SelectContent>
                {quarters.map(q => (
                  <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openNewDialog} className="premium-button">
            <Plus className="h-4 w-4 mr-2" /> Novo Destaque
          </Button>
        </div>
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
                  <div className="flex-1">
                    <Badge variant="warning" className="uppercase text-[10px] tracking-widest font-bold mb-1">
                      ⭐ Aluno Destaque
                    </Badge>
                    <p className="text-xl font-extrabold text-gray-900 mt-1">{latestDestaque?.student?.name || "A definir"}</p>
                    <p className="text-sm text-gray-500 font-medium">Classe: {latestDestaque?.class?.name || "—"}</p>
                    {latestDestaque && (
                      <>
                        <p className="text-sm text-gray-600 mt-3 italic leading-relaxed">&ldquo;{latestDestaque.reason}&rdquo;</p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-1 text-amber-600">
                            <Calendar className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase">{latestDestaque.quarter}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-primary" onClick={() => openEditDialog(latestDestaque)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => openDeleteDialog(latestDestaque)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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
                  <div className="flex-1">
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none uppercase text-[10px] tracking-widest font-bold mb-1">
                      🏆 Aluno Missionário
                    </Badge>
                    <p className="text-xl font-extrabold text-gray-900 mt-1">{latestMissionario?.student?.name || "A definir"}</p>
                    <p className="text-sm text-gray-500 font-medium">Classe: {latestMissionario?.class?.name || "—"}</p>
                    {latestMissionario && (
                      <>
                        <p className="text-sm text-gray-600 mt-3 italic leading-relaxed">&ldquo;{latestMissionario.reason}&rdquo;</p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-1 text-primary">
                            <Calendar className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase">{latestMissionario.quarter}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-primary" onClick={() => openEditDialog(latestMissionario)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => openDeleteDialog(latestMissionario)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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
                  <div key={d.id} className="flex items-center justify-between p-5 hover:bg-gray-50/50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                        d.type === "destaque" ? "bg-amber-50 text-amber-500" : "bg-blue-50 text-primary"
                      }`}>
                        {d.type === "destaque" ? <Star className="h-6 w-6" /> : <Trophy className="h-6 w-6" />}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{d.student?.name}</p>
                        <p className="text-xs text-gray-500 font-medium">{d.class?.name} • {new Date(d.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</p>
                        <p className="text-sm text-gray-600 italic mt-1">&ldquo;{d.reason}&rdquo;</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                       <div className="flex items-center gap-1">
                         <Badge variant={d.type === "destaque" ? "warning" : "default"}>
                          {d.type === "destaque" ? "Destaque" : "Missionário"}
                        </Badge>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-primary" onClick={() => openEditDialog(d)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => openDeleteDialog(d)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{d.quarter}</span>
                    </div>
                  </div>
                ))}
                {highlights.length === 0 && (
                   <div className="p-10 text-center text-gray-400 italic">
                    Nenhum destaque registrado neste trimestre.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingHighlight(null); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">
              {editingHighlight ? "Editar Reconhecimento" : "Novo Reconhecimento"}
            </DialogTitle>
            <DialogDescription>
              {editingHighlight ? "Alterar dados do reconhecimento" : "Premiar um aluno exemplar ou missionário"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label htmlFor="studentId" className="font-bold">Qual Aluno?</Label>
              <Select value={formStudentId} onValueChange={setFormStudentId} required>
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
                <Select value={formType} onValueChange={setFormType}>
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
                <Select value={formQuarter} onValueChange={setFormQuarter}>
                  <SelectTrigger className="h-11 rounded-lg">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {quarters.map(q => (
                      <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="font-bold">Motivo do Reconhecimento</Label>
              <Textarea 
                id="reason" 
                value={formReason} 
                onChange={(e) => setFormReason(e.target.value)} 
                required 
                className="rounded-lg resize-none min-h-[100px]" 
                placeholder="Ex: Participativo em todas as lições e trouxe 5 novos convidados..." 
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
               <Button type="button" variant="ghost" onClick={() => { setIsDialogOpen(false); setEditingHighlight(null); }} disabled={submitting}>Cancelar</Button>
               <Button type="submit" disabled={submitting || !formStudentId || !formReason} className="premium-button min-w-[120px]">
                 {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingHighlight ? "Salvar Alterações" : "Consagrar Aluno"}
               </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) setDeletingHighlight(null); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-red-600">Excluir Destaque</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o reconhecimento de <strong>{deletingHighlight?.student?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button type="button" variant="ghost" onClick={() => { setIsDeleteDialogOpen(false); setDeletingHighlight(null); }} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={submitting} className="min-w-[120px]">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
