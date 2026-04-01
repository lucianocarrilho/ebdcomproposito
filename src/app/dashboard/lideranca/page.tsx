"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { 
  Plus, Edit, Trash2, Search, Crown, Mail, Phone, 
  Calendar, Info, Loader2, Camera, User as UserIcon, Layers 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

export default function LiderancaPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("Todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLeader, setEditingLeader] = useState<Leader | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Controlled Select values
  const [selectedRole, setSelectedRole] = useState<string>("Professor");
  const [selectedClass, setSelectedClass] = useState<string>("none");
  const [photoUrl, setPhotoUrl] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [leadRes, classRes] = await Promise.all([
        fetch("/api/leaders"),
        fetch("/api/classes")
      ]);
      if (!leadRes.ok || !classRes.ok) throw new Error("Falha ao buscar dados");
      const leadData = await leadRes.json();
      const classData = await classRes.json();
      setLeaders(Array.isArray(leadData) ? leadData : []);
      setClasses(Array.isArray(classData) ? classData : []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados da liderança");
    } finally {
      setLoading(false);
    }
  }

  const filtered = Array.isArray(leaders) ? leaders.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "Todos" || l.role === filterRole;
    return matchSearch && matchRole;
  }) : [];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Submit disparado!");
    setSaving(true);
    
    try {
      const fd = new FormData(e.currentTarget);
      const dateValue = fd.get("startDate") as string;
      
      let finalDate = new Date();
      if (dateValue) {
        const parsed = new Date(dateValue);
        if (!isNaN(parsed.getTime())) {
          finalDate = parsed;
        }
      }
      
      const payload = {
        name: fd.get("name"),
        role: selectedRole,
        phone: fd.get("phone"),
        email: fd.get("email"),
        classId: selectedClass === "none" || selectedClass === "" ? null : selectedClass,
        startDate: finalDate.toISOString(),
        observations: fd.get("observations"),
        photo: photoUrl,
      };

      console.log("Payload:", payload);

      const url = editingLeader ? `/api/leaders/${editingLeader.id}` : "/api/leaders";
      const method = editingLeader ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingLeader ? "Cadastro atualizado!" : "Líder cadastrado com sucesso!");
        await fetchData();
        setIsDialogOpen(false);
        setEditingLeader(null);
        setPhotoUrl("");
      } else {
        const err = await res.json().catch(() => ({ error: "Erro interno no servidor" }));
        toast.error(err.error || "Erro ao salvar líder");
      }
    } catch (error: any) {
      console.error("Erro no formulário:", error);
      toast.error("Ocorreu um erro: " + (error.message || "desconhecido"));
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

  const openEditDialog = (leader: Leader) => {
    setEditingLeader(leader);
    setPhotoUrl(leader.photo || "");
    setSelectedRole(leader.role);
    setSelectedClass(leader.classId || "none");
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingLeader(null);
    setPhotoUrl("");
    setSelectedRole("Professor");
    setSelectedClass("none");
    setIsDialogOpen(true);
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "Dirigente": return "bg-blue-100 text-blue-700 border-blue-200";
      case "Vice-Dirigente": return "bg-purple-100 text-purple-700 border-purple-200";
      case "Professor": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-gray-500">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p>Carregando liderança...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl">Liderança</h1>
          <p className="page-subtitle">Gestão de professores, dirigentes e voluntários</p>
        </div>
        <Button onClick={openNewDialog} className="shadow-lg shadow-primary/20 rounded-full">
          <Plus className="h-4 w-4" /> Novo Líder
        </Button>
      </div>

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
      </div>

      <Card className="rounded-2xl border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead className="font-bold">Nome</TableHead>
                <TableHead className="font-bold">Cargo</TableHead>
                <TableHead className="hidden md:table-cell font-bold">Classe</TableHead>
                <TableHead className="hidden lg:table-cell font-bold">Contato</TableHead>
                <TableHead className="text-right font-bold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(l => (
                <TableRow key={l.id} className="hover:bg-gray-50/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
                        {l.photo ? (
                          <Image src={l.photo} alt={l.name} width={40} height={40} className="object-cover" />
                        ) : (
                          <div className="bg-primary/10 w-full h-full flex items-center justify-center">
                            <Crown className="h-4 w-4 text-primary" />
                          </div>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900">{l.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("rounded-full font-bold text-[10px] uppercase tracking-wider", roleColor(l.role))}>
                      {l.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {l.class ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Layers className="h-3 w-3 text-blue-500" />
                        {l.class.name}
                      </div>
                    ) : (
                       <span className="text-gray-300 text-xs italic">---</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="text-xs space-y-1">
                      {l.phone && <div className="flex items-center gap-1.5 text-gray-500"><Phone className="h-3 w-3 text-emerald-500" />{l.phone}</div>}
                      {l.email && <div className="flex items-center gap-1.5 text-gray-500"><Mail className="h-3 w-3 text-blue-400" />{l.email}</div>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/5 hover:text-primary" onClick={() => openEditDialog(l)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-500" onClick={() => setDeleteConfirm(l.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-gray-400 italic">
                    Nenhum líder encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              {editingLeader ? "Editar Líder" : "Novo Líder"}
            </DialogTitle>
            <DialogDescription>Cadastre os responsáveis pela EBD e classes.</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
              <div className="w-full md:w-32 flex-shrink-0">
                <ImageUpload 
                  onUpload={setPhotoUrl} 
                  defaultImage={photoUrl} 
                  label="Foto Perfil"
                />
              </div>
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-bold text-gray-500 uppercase">Nome Completo *</Label>
                  <Input id="name" name="name" required defaultValue={editingLeader?.name} className="bg-white rounded-xl" placeholder="Ex: Xavier da Silva" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-xs font-bold text-gray-500 uppercase">Cargo na EBD *</Label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-bold text-gray-500 uppercase">Telefone</Label>
                <Input id="phone" name="phone" defaultValue={editingLeader?.phone || ""} className="bg-white rounded-xl" placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold text-gray-500 uppercase">E-mail</Label>
                <Input id="email" name="email" type="email" defaultValue={editingLeader?.email || ""} className="bg-white rounded-xl" placeholder="exemplo@igreja.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="classId" className="text-xs font-bold text-gray-500 uppercase">Classe Designada</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="bg-white rounded-xl"><SelectValue placeholder="Selecione a classe" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sede / Geral</SelectItem>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-xs font-bold text-gray-500 uppercase">Data Início</Label>
                <Input id="startDate" name="startDate" type="date" defaultValue={editingLeader?.startDate ? new Date(editingLeader.startDate).toISOString().split("T")[0] : ""} className="bg-white rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observations" className="text-xs font-bold text-gray-500 uppercase">Observações Internas</Label>
              <Textarea id="observations" name="observations" defaultValue={editingLeader?.observations || ""} className="rounded-xl min-h-[80px]" placeholder="Alguma observação relevante..." />
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving} className="rounded-full">Cancelar</Button>
              <Button type="submit" disabled={saving} className="rounded-full shadow-lg shadow-primary/20 min-w-32">
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
                ) : (editingLeader ? "Salvar Alterações" : "Cadastrar Líder")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alerta de Exclusão */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-red-600">Confirmar Remoção</DialogTitle>
            <DialogDescription>
              Deseja remover este líder? O registro será apenas desativado para manter o histórico de lições.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-full">Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} className="rounded-full">Confirmar Exclusão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
