"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { 
  Plus, Edit, Search, BookOpen, Trash2, 
  Calendar, Loader2, Image as ImageIcon,
  ChevronLeft, ChevronRight, BookMarked,
  CheckCircle, Clock, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ImageUpload } from "@/components/image-upload";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

// Categorias de revistas da EBD
const CATEGORIES = [
  { id: "Adultos", label: "Adultos", icon: "👨‍👩‍👦", description: "Homens e Mulheres" },
  { id: "Jovens", label: "Jovens", icon: "🧑", description: "Classe de Jovens" },
  { id: "Adolescentes", label: "Adolescentes", icon: "👦", description: "Classe de Adolescentes" },
  { id: "Crianças", label: "Crianças", icon: "🧒", description: "Classe de Crianças" },
];

// Gerar lista de trimestres
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

// Calcular as 13 datas de domingo a partir do início do trimestre
function getSundayDates(quarterStart: string): string[] {
  const dates: string[] = [];
  const start = new Date(quarterStart);
  // Ajustar para o próximo domingo se não for domingo
  const day = start.getDay();
  if (day !== 0) {
    start.setDate(start.getDate() + (7 - day));
  }
  for (let i = 0; i < 13; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

// Datas de início dos trimestres de 2026
const QUARTER_STARTS: Record<string, string> = {
  "2025-Q1": "2025-01-05",
  "2025-Q2": "2025-04-06",
  "2025-Q3": "2025-07-06",
  "2025-Q4": "2025-10-05",
  "2026-Q1": "2026-01-04",
  "2026-Q2": "2026-04-05",
  "2026-Q3": "2026-07-05",
  "2026-Q4": "2026-10-04",
  "2027-Q1": "2027-01-03",
  "2027-Q2": "2027-04-04",
  "2027-Q3": "2027-07-04",
  "2027-Q4": "2027-10-03",
};

function getCurrentQuarter(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const q = Math.ceil(month / 3);
  return `${now.getFullYear()}-Q${q}`;
}

interface Lesson {
  id: string;
  number: number;
  title: string;
  quarter: string;
  category: string;
  date: string | null;
  summary: string | null;
  bibleText: string | null;
  image: string | null;
  status: string;
}

export default function LicoesPage() {
  const { data: session } = useSession();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userClasses, setUserClasses] = useState<any[]>([]);
  
  // Filtros
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());
  const [selectedCategory, setSelectedCategory] = useState("Adultos");
  
  // Dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("pendente");
  
  // Delete
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null);

  const quarters = getQuarters();

  // Fetch classes to determine allowed categories
  useEffect(() => {
    const fetchUserClasses = async () => {
      try {
        const res = await fetch("/api/classes");
        if (res.ok) {
          const data = await res.json();
          setUserClasses(data);
          
          // Se for professor, mudar a categoria inicial para a primeira disponível
          const role = (session?.user as any)?.role;
          if (role === "PROFESSOR") {
            const allowed = CATEGORIES.filter(cat => 
              data.some((cls: any) => cls.name.toLowerCase().includes(cat.id.toLowerCase().substring(0, 5)))
            );
            if (allowed.length > 0 && !allowed.find(a => a.id === selectedCategory)) {
              setSelectedCategory(allowed[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao buscar classes do usuário:", err);
      }
    };
    if (session) fetchUserClasses();
  }, [session, selectedCategory]);

  const fetchLessons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lessons?quarter=${selectedQuarter}&category=${selectedCategory}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      if (res.ok) {
        const data = await res.json();
        setLessons(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Erro ao buscar lições:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedQuarter, selectedCategory]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  // Gerar slots de 13 lições
  const sundayDates = getSundayDates(QUARTER_STARTS[selectedQuarter] || "2026-04-05");
  
  const lessonSlots = Array.from({ length: 13 }, (_, i) => {
    const num = i + 1;
    const existing = lessons.find(l => l.number === num);
    return {
      number: num,
      date: sundayDates[i],
      lesson: existing || null,
    };
  });

  const registeredCount = lessons.length;
  const completedCount = lessons.filter(l => l.status === "concluída").length;

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      const lessonNumber = Number(fd.get("number"));
      const dateValue = fd.get("date") as string;
      
      const payload = {
        number: lessonNumber,
        title: fd.get("title"),
        quarter: selectedQuarter,
        category: selectedCategory,
        date: dateValue || null,
        bibleText: fd.get("bibleText"),
        summary: fd.get("summary"),
        status: selectedStatus,
        image: photoUrl,
      };

      const url = editingLesson ? `/api/lessons/${editingLesson.id}` : "/api/lessons";
      const method = editingLesson ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingLesson ? "Lição atualizada!" : "Lição cadastrada!");
        await fetchLessons();
        setIsDialogOpen(false);
        setEditingLesson(null);
        setPhotoUrl("");
      } else {
        const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        toast.error(err.error || "Erro ao salvar lição");
      }
    } catch (error: any) {
      toast.error("Erro: " + (error.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!lessonToDelete) return;
    try {
      const res = await fetch(`/api/lessons/${lessonToDelete}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Lição excluída");
        await fetchLessons();
      }
    } catch {
      toast.error("Erro ao excluir");
    }
    setIsDeleteDialogOpen(false);
    setLessonToDelete(null);
  };

  const openNewDialog = (slotNumber: number, slotDate: string) => {
    setEditingLesson(null);
    setPhotoUrl("");
    setSelectedStatus("pendente");
    // Pre-fill with slot data
    setTimeout(() => {
      const numInput = document.getElementById("lessonNumber") as HTMLInputElement;
      const dateInput = document.getElementById("lessonDate") as HTMLInputElement;
      if (numInput) numInput.value = String(slotNumber);
      if (dateInput) dateInput.value = slotDate;
    }, 100);
    setIsDialogOpen(true);
  };

  const openEditDialog = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setPhotoUrl(lesson.image || "");
    setSelectedStatus(lesson.status);
    setIsDialogOpen(true);
  };

  const navigateQuarter = (direction: number) => {
    const idx = quarters.findIndex(q => q.value === selectedQuarter);
    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < quarters.length) {
      setSelectedQuarter(quarters[newIdx].value);
    }
  };

  const currentQuarterLabel = quarters.find(q => q.value === selectedQuarter)?.label || selectedQuarter;

  const filteredCategories = CATEGORIES.filter(cat => {
    const role = (session?.user as any)?.role;
    if (role === "ADMIN") return true;
    
    // Para professores, mostramos apenas categorias que batem com o nome das classes deles
    return userClasses.some((cls: any) => 
      cls.name.toLowerCase().includes(cat.id.toLowerCase().substring(0, 5))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title text-2xl flex items-center gap-2">
              <BookMarked className="h-6 w-6 text-primary" />
              Gestão de Lições
            </h1>
            <p className="page-subtitle">
              {registeredCount} de 13 lições cadastradas • {completedCount} concluídas
            </p>
          </div>
        </div>
      </div>

      {/* Seletor de Trimestre */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigateQuarter(-1)} className="rounded-full">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-3 shadow-sm min-w-[220px] text-center">
          <p className="text-lg font-bold text-gray-900">{currentQuarterLabel}</p>
          <p className="text-xs text-gray-400">
            Início: {new Date(QUARTER_STARTS[selectedQuarter] || "2026-04-05").toLocaleDateString("pt-BR")}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigateQuarter(1)} className="rounded-full">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Abas de Categoria (Revista) */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filteredCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-2xl border-2 transition-all duration-200 whitespace-nowrap font-semibold text-sm",
              selectedCategory === cat.id
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]"
                : "bg-white text-gray-600 border-gray-200 hover:border-primary/30 hover:bg-primary/5"
            )}
          >
            <span className="text-lg">{cat.icon}</span>
            <div className="text-left">
              <p>{cat.label}</p>
              <p className={cn(
                "text-[10px] font-normal",
                selectedCategory === cat.id ? "text-white/70" : "text-gray-400"
              )}>{cat.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Grid de 13 Lições */}
      {loading ? (
        <div className="h-[40vh] flex flex-col items-center justify-center gap-4 text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Carregando lições...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {lessonSlots.map((slot) => (
            <Card 
              key={slot.number} 
              className={cn(
                "group overflow-hidden transition-all duration-300 hover:shadow-lg border-2 rounded-2xl",
                slot.lesson 
                  ? slot.lesson.status === "concluída" 
                    ? "border-emerald-200 bg-emerald-50/30" 
                    : slot.lesson.status === "em andamento"
                    ? "border-amber-200 bg-amber-50/30"
                    : "border-gray-200 bg-white"
                  : "border-dashed border-gray-200 bg-gray-50/50"
              )}
            >
              {slot.lesson ? (
                /* Lição cadastrada */
                <>
                  {slot.lesson.image && (
                    <div className="relative h-32 overflow-hidden">
                      <Image src={slot.lesson.image} alt={slot.lesson.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-primary text-white text-xs font-black px-2 py-0.5 rounded-lg">
                          {slot.number}
                        </span>
                        <Badge variant="outline" className={cn(
                          "text-[10px] rounded-full font-bold uppercase",
                          slot.lesson.status === "concluída" ? "border-emerald-300 text-emerald-700 bg-emerald-50" :
                          slot.lesson.status === "em andamento" ? "border-amber-300 text-amber-700 bg-amber-50" :
                          "border-gray-300 text-gray-500"
                        )}>
                          {slot.lesson.status === "concluída" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {slot.lesson.status === "em andamento" && <Clock className="h-3 w-3 mr-1" />}
                          {slot.lesson.status}
                        </Badge>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(slot.lesson!)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-500" onClick={() => { setLessonToDelete(slot.lesson!.id); setIsDeleteDialogOpen(true); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    
                    <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 mb-2">
                      {slot.lesson.title}
                    </h3>
                    
                    {slot.lesson.bibleText && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                        <BookOpen className="h-3 w-3 text-primary flex-shrink-0" />
                        <span className="truncate">{slot.lesson.bibleText}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span>{slot.lesson.date ? new Date(slot.lesson.date).toLocaleDateString("pt-BR") : slot.date ? new Date(slot.date).toLocaleDateString("pt-BR") : "---"}</span>
                    </div>
                  </CardContent>
                </>
              ) : (
                /* Slot vazio — lição não cadastrada ainda */
                <CardContent className="p-4 flex flex-col items-center justify-center min-h-[160px] gap-3">
                  <div className="flex items-center gap-2 text-gray-300">
                    <span className="text-2xl font-black">{slot.number}</span>
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    {slot.date ? new Date(slot.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : `Domingo ${slot.number}`}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-full border-dashed text-xs text-gray-400 hover:text-primary hover:border-primary"
                    onClick={() => openNewDialog(slot.number, slot.date)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Cadastrar
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Cadastro / Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <BookMarked className="h-5 w-5 text-primary" />
              {editingLesson ? "Editar Lição" : "Nova Lição"}
            </DialogTitle>
            <DialogDescription>
              {currentQuarterLabel} • Revista {selectedCategory}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSave} className="space-y-4">
            {/* Capa */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <ImageUpload 
                onUpload={setPhotoUrl} 
                defaultImage={photoUrl} 
                label="Capa da Lição"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase">Nº da Lição</Label>
                <Input 
                  id="lessonNumber" 
                  name="number" 
                  type="number" 
                  min={1} max={13} 
                  required 
                  defaultValue={editingLesson?.number} 
                  className="bg-white rounded-xl text-center text-lg font-bold"
                  placeholder="1-13"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase">Data da Aula</Label>
                <Input 
                  id="lessonDate" 
                  name="date" 
                  type="date" 
                  defaultValue={editingLesson?.date ? new Date(editingLesson.date).toISOString().split("T")[0] : ""} 
                  className="bg-white rounded-xl"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase">Título da Lição *</Label>
              <Input 
                name="title" 
                required 
                defaultValue={editingLesson?.title} 
                className="bg-white rounded-xl" 
                placeholder="Ex: Abraão: Seu chamado e sua jornada de fé"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase">Texto Bíblico</Label>
              <Input 
                name="bibleText" 
                defaultValue={editingLesson?.bibleText || ""} 
                className="bg-white rounded-xl" 
                placeholder="Ex: Gênesis 12.1-9"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase">Status</Label>
              <div className="space-y-2">
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="bg-white rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">📋 Pendente</SelectItem>
                    <SelectItem value="em andamento">⏳ Em Andamento</SelectItem>
                    <SelectItem value="concluída">✅ Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase">Resumo / Verdade Prática</Label>
              <Textarea 
                name="summary" 
                defaultValue={editingLesson?.summary || ""} 
                className="rounded-xl min-h-[80px]" 
                placeholder="Ex: O chamado de Deus na vida de Abraão exige obediência irrestrita, fé e perseverança."
              />
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving} className="rounded-full">
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="rounded-full shadow-lg shadow-primary/20 min-w-32">
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
                ) : (editingLesson ? "Atualizar" : "Cadastrar Lição")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alert para Excluir */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja excluir esta lição? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 rounded-full">
              Excluir Lição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
