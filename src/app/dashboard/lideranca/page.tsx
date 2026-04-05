"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { 
  Plus, Edit, Trash2, Search, Crown, Mail, Phone, 
  Calendar, Info, Loader2, User as UserIcon, Layers,
  Check, X, MessageSquare, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/image-upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Leader {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  classId: string | null;
  class?: { name: string };
  startDate: string;
  observations: string | null;
  photo: string | null;
  active: boolean;
}

interface Class {
  id: string;
  name: string;
}

interface AttendanceItem {
  leaderId: string;
  status: "PRESENTE" | "FALTA" | "FALTA_JUSTIFICADA";
  justification: string;
}

export default function LiderancaPage() {
  const [activeTab, setActiveTab] = useState<"quadro" | "presenca">("quadro");
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("Todos");
  
  // States para Chamada
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceItems, setAttendanceItems] = useState<Record<string, AttendanceItem>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLeader, setEditingLeader] = useState<Leader | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [selectedRole, setSelectedRole] = useState<string>("Professor");
  const [selectedClass, setSelectedClass] = useState<string>("none");
  const [photoUrl, setPhotoUrl] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === "presenca") {
      fetchAttendance();
    }
  }, [activeTab, attendanceDate]);

  async function fetchData() {
    try {
      const [leadRes, classRes] = await Promise.all([
        fetch("/api/leaders"),
        fetch("/api/classes")
      ]);
      const leadData = await leadRes.json();
      const classData = await classRes.json();
      setLeaders(Array.isArray(leadData) ? leadData : []);
      setClasses(Array.isArray(classData) ? classData : []);
      
      // Inicializar itens de chamada padrão para todos os líderes
      const initial: Record<string, AttendanceItem> = {};
      leadData.forEach((l: Leader) => {
        initial[l.id] = { leaderId: l.id, status: "PRESENTE", justification: "" };
      });
      setAttendanceItems(initial);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAttendance() {
    try {
      const res = await fetch(`/api/attendance/leaders?date=${attendanceDate}`);
      if (res.ok) {
        const data = await res.json();
        const updatedItems = { ...attendanceItems };
        data.forEach((item: any) => {
          updatedItems[item.leaderId] = {
            leaderId: item.leaderId,
            status: item.status,
            justification: item.justification || ""
          };
        });
        setAttendanceItems(updatedItems);
      }
    } catch (error) {
      console.error("Erro ao buscar presença:", error);
    }
  }

  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    try {
      const items = Object.values(attendanceItems);
      const res = await fetch("/api/attendance/leaders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: attendanceDate, items })
      });

      if (res.ok) {
        toast.success("Chamada da Liderança salva!");
      } else {
        toast.error("Erro ao salvar chamada");
      }
    } catch (error) {
      toast.error("Erro de conexão");
    } finally {
      setSavingAttendance(false);
    }
  };

  const updateStatus = (leaderId: string, status: "PRESENTE" | "FALTA" | "FALTA_JUSTIFICADA") => {
    setAttendanceItems(prev => ({
      ...prev,
      [leaderId]: { ...prev[leaderId], status, leaderId }
    }));
  };

  const updateJustification = (leaderId: string, justification: string) => {
    setAttendanceItems(prev => ({
      ...prev,
      [leaderId]: { ...prev[leaderId], justification }
    }));
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      const dateValue = fd.get("startDate") as string;
      const startDate = dateValue ? new Date(dateValue).toISOString() : new Date().toISOString();

      const payload = {
        name: fd.get("name"),
        role: selectedRole,
        phone: fd.get("phone"),
        email: fd.get("email"),
        classId: selectedClass === "none" || selectedClass === "" ? null : selectedClass,
        startDate,
        observations: fd.get("observations"),
        photo: photoUrl,
      };

      const url = editingLeader ? `/api/leaders/${editingLeader.id}` : "/api/leaders";
      const method = editingLeader ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingLeader ? "Cadastro atualizado!" : "Líder cadastrado!");
        fetchData();
        setIsDialogOpen(false);
      }
    } catch (error) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`/api/leaders/${deleteConfirm}`, { method: "DELETE" });
      if (res.ok) {
        setLeaders(leaders.filter(l => l.id !== deleteConfirm));
        setDeleteConfirm(null);
        toast.success("Líder removido");
      }
    } catch (error) {
      toast.error("Erro ao remover");
    }
  };

  const filtered = leaders.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "Todos" || l.role === filterRole;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-bold text-gray-900">Gestão da Liderança</h1>
          <p className="page-subtitle text-gray-500">Controle de presenças e cadastros da equipe</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab("quadro")}
            className={cn(
              "px-4 py-2 text-sm font-bold rounded-xl transition-all",
              activeTab === "quadro" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            Quadro de Líderes
          </button>
          <button 
            onClick={() => setActiveTab("presenca")}
            className={cn(
              "px-4 py-2 text-sm font-bold rounded-xl transition-all",
              activeTab === "presenca" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            Chamada da Liderança
          </button>
        </div>
      </div>

      {activeTab === "quadro" ? (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Buscar por nome..." className="pl-9 shadow-sm rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-48 shadow-sm rounded-xl bg-white">
                <SelectValue placeholder="Filtrar cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os Cargos</SelectItem>
                <SelectItem value="Dirigente">Dirigente</SelectItem>
                <SelectItem value="Vice-Dirigente">Vice-Dirigente</SelectItem>
                <SelectItem value="Professor">Professor</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditingLeader(null); setPhotoUrl(""); setIsDialogOpen(true); }} className="shadow-lg shadow-primary/20 rounded-xl ml-auto">
              <Plus className="h-4 w-4 mr-2" /> Novo Líder
            </Button>
          </div>

          <Card className="rounded-2xl border-gray-100 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="font-bold">Nome / Contato</TableHead>
                  <TableHead className="font-bold">Cargo</TableHead>
                  <TableHead className="hidden md:table-cell font-bold">Classe</TableHead>
                  <TableHead className="text-right font-bold pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(l => (
                  <TableRow key={l.id} className="hover:bg-gray-50/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                          {l.photo ? (
                            <img src={l.photo} alt={l.name} className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 leading-tight">{l.name}</p>
                          <p className="text-[10px] text-gray-400">{l.email || l.phone || "Sem contato"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 font-bold text-[10px] uppercase">
                        {l.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {l.class ? <Badge variant="outline" className="text-gray-500">{l.class.name}</Badge> : <span className="text-gray-300 italic text-xs">Geral</span>}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-primary" onClick={() => { setEditingLeader(l); setPhotoUrl(l.photo || ""); setIsDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => setDeleteConfirm(l.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : (
        <div className="space-y-6">
          <Card className="rounded-3xl border-primary/10 shadow-xl overflow-hidden bg-white">
            <CardHeader className="border-b border-gray-50 bg-gray-50/30 py-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Chamada da Equipe</CardTitle>
                    <CardDescription>Marque a presença dos líderes para o dia selecionado</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border shadow-sm">
                  <Label htmlFor="attDate" className="text-xs font-bold text-gray-400 pl-2">DATA:</Label>
                  <Input 
                    id="attDate" 
                    type="date" 
                    className="border-none bg-transparent font-bold text-primary focus-visible:ring-0 w-36" 
                    value={attendanceDate}
                    onChange={e => setAttendanceDate(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead className="font-bold w-1/3 pl-8">Líder / Cargo</TableHead>
                      <TableHead className="font-bold text-center">Status de Presença</TableHead>
                      <TableHead className="font-bold">Justificativa de Ausência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaders.map(l => {
                      const itemCtx = attendanceItems[l.id] || { status: "PRESENTE", justification: "" };
                      return (
                        <TableRow key={l.id} className="hover:bg-gray-50/30 border-b border-gray-50 transition-colors">
                          <TableCell className="pl-8 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
                                {l.photo ? <img src={l.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-primary/5 flex items-center justify-center text-primary font-bold">{l.name[0]}</div>}
                              </div>
                              <div>
                                <p className="font-bold text-gray-800 leading-tight">{l.name}</p>
                                <p className="text-[10px] text-primary/70 font-bold uppercase tracking-wider">{l.role}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => updateStatus(l.id, "PRESENTE")}
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                                  itemCtx.status === "PRESENTE" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200 scale-110" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                )}
                              >
                                <Check className="h-5 w-5" />
                              </button>
                              <button 
                                onClick={() => updateStatus(l.id, "FALTA")}
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                                  itemCtx.status === "FALTA" ? "bg-red-500 text-white shadow-lg shadow-red-200 scale-110" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                )}
                              >
                                <X className="h-5 w-5" />
                              </button>
                              <button 
                                onClick={() => updateStatus(l.id, "FALTA_JUSTIFICADA")}
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                                  itemCtx.status === "FALTA_JUSTIFICADA" ? "bg-amber-500 text-white shadow-lg shadow-amber-200 scale-110" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                )}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="pr-8">
                            {itemCtx.status !== "PRESENTE" && (
                              <Input 
                                placeholder="Motivo da falta..." 
                                className="h-9 text-xs rounded-xl bg-gray-50/50 border-gray-100"
                                value={itemCtx.justification}
                                onChange={e => updateJustification(l.id, e.target.value)}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="p-6 bg-gray-50/30 border-t flex items-center justify-between">
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Presenças e faltas serão registradas no histórico do líder.
                </p>
                <Button onClick={handleSaveAttendance} disabled={savingAttendance} className="rounded-2xl px-8 shadow-xl hover:scale-105 active:scale-95 transition-all">
                  {savingAttendance ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Chamada da Equipe
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog Criar/Editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editingLeader ? "Editar Líder" : "Novo Líder"}</DialogTitle>
            <DialogDescription>Cadastre os responsáveis pela EBD e classes.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-6 pt-4">
            <div className="flex gap-6 items-start bg-gray-50 p-6 rounded-2xl">
              <div className="w-32 flex-shrink-0">
                <ImageUpload onUpload={setPhotoUrl} defaultImage={photoUrl} label="Foto Perfil" />
              </div>
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input id="name" name="name" required defaultValue={editingLeader?.name} className="bg-white rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Cargo / Perfil *</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="bg-white rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dirigente">Dirigente</SelectItem>
                      <SelectItem value="Vice-Dirigente">Vice-Dirigente</SelectItem>
                      <SelectItem value="Professor">Professor</SelectItem>
                      <SelectItem value="Apoio">Apoio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" defaultValue={editingLeader?.phone || ""} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={editingLeader?.email || ""} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Classe Selecionada</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sede / Geral</SelectItem>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Início</Label>
                <Input id="startDate" name="startDate" type="date" defaultValue={editingLeader?.startDate?.split("T")[0]} className="rounded-xl" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancelar</Button>
              <Button type="submit" disabled={saving} className="rounded-xl bg-primary px-8">
                {saving ? "Salvando..." : "Salvar Líder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
