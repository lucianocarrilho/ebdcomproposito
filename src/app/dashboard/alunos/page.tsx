"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Plus, Edit, Trash2, Search, Eye, Users, Phone, MapPin,
  Calendar, ChevronDown, Filter, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/image-upload";

interface Student {
  id: string;
  name: string;
  gender: string;
  birthDate: string;
  phone: string;
  address: string;
  guardian: string;
  classId: string;
  class?: { name: string };
  enrollmentDate: string;
  active: boolean;
  observations: string;
  photo?: string | null;
  baptized: boolean;
  member: boolean;
  newConvert: boolean;
}

interface Class {
  id: string;
  name: string;
}

export default function AlunosPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("Todas");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [stuRes, clsRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/classes"),
      ]);
      const stuData = await stuRes.json();
      const clsData = await clsRes.json();
      setStudents(stuData);
      setClasses(clsData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  const filtered = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchClass = filterClass === "Todas" || s.classId === filterClass;
    return matchSearch && matchClass;
  });

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    
    const payload = {
      name: fd.get("name"),
      gender: fd.get("gender"),
      birthDate: fd.get("birthDate") ? new Date(fd.get("birthDate") as string).toISOString() : null,
      phone: fd.get("phone"),
      address: fd.get("address"),
      guardian: fd.get("guardian"),
      classId: fd.get("classId"),
      enrollmentDate: fd.get("enrollmentDate") ? new Date(fd.get("enrollmentDate") as string).toISOString() : new Date().toISOString(),
      active: true,
      observations: fd.get("observations"),
      photo: photoUrl,
      baptized: fd.get("baptized") === "on",
      member: fd.get("member") === "on",
      newConvert: fd.get("newConvert") === "on",
    };

    try {
      const url = editingStudent ? `/api/students/${editingStudent.id}` : "/api/students";
      const method = editingStudent ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchData();
        setIsDialogOpen(false);
        setEditingStudent(null);
        setPhotoUrl("");
      }
    } catch (error) {
      console.error("Erro ao salvar aluno:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
      if (res.ok) {
        setStudents(students.filter((s) => s.id !== id));
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Erro ao deletar aluno:", error);
    }
  };

  const openNewStudentDialog = () => {
    setEditingStudent(null);
    setPhotoUrl("");
    setIsDialogOpen(true);
  };

  const openEditStudentDialog = (student: Student) => {
    setEditingStudent(student);
    setPhotoUrl(student.photo || "");
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-gray-500">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p>Carregando alunos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Alunos</h1>
          <p className="page-subtitle">
            {students.length} alunos cadastrados • {students.filter(s => s.active).length} ativos
          </p>
        </div>
        <Button onClick={openNewStudentDialog}>
          <Plus className="h-4 w-4" /> Novo Aluno
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Buscar aluno..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue placeholder="Filtrar por classe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas as Classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Classe</TableHead>
                <TableHead className="hidden lg:table-cell">Telefone</TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-white shadow-sm">
                        {s.photo ? (
                          <Image src={s.photo} alt={s.name} width={40} height={40} className="object-cover" />
                        ) : (
                          <span className="text-sm font-semibold text-primary">
                            {s.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500 md:hidden">{s.class?.name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="default">{s.class?.name || "Sem classe"}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-gray-600">{s.phone || "-"}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {s.baptized && <Badge variant="success" className="text-[10px]">Batizado</Badge>}
                      {s.member && <Badge variant="default" className="text-[10px]">Membro</Badge>}
                      {s.newConvert && <Badge variant="warning" className="text-[10px]">Novo Convertido</Badge>}
                      {!s.active && <Badge variant="destructive" className="text-[10px]">Inativo</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/dashboard/alunos/${s.id}`}>
                        <Button variant="ghost" size="icon" title="Ver detalhes">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => openEditStudentDialog(s)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Excluir" onClick={() => setDeleteConfirm(s.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Nenhum aluno encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Novo/Editar Aluno */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStudent ? "Editar Aluno" : "Novo Aluno"}</DialogTitle>
            <DialogDescription>
              {editingStudent ? "Atualize os dados do aluno" : "Preencha os dados do novo aluno"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 flex flex-col sm:flex-row items-center gap-6 bg-gray-50/50 p-4 rounded-xl border border-dashed border-gray-200">
                <ImageUpload 
                  onUpload={(url) => setPhotoUrl(url)} 
                  defaultImage={photoUrl} 
                  label="Foto do Aluno"
                />
                <div className="flex-1 space-y-1">
                  <h4 className="text-sm font-medium">Avatar do Aluno</h4>
                  <p className="text-xs text-gray-500">
                    A foto ajudará os professores a identificarem os alunos rapidamente no dashboard e nas listas de presença.
                  </p>
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input id="name" name="name" required defaultValue={editingStudent?.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Sexo</Label>
                <Select name="gender" defaultValue={editingStudent?.gender || "M"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de Nascimento</Label>
                <Input id="birthDate" name="birthDate" type="date" defaultValue={editingStudent?.birthDate ? new Date(editingStudent.birthDate).toISOString().split("T")[0] : ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" defaultValue={editingStudent?.phone} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="classId">Classe *</Label>
                <Select name="classId" defaultValue={editingStudent?.classId || (classes[0]?.id)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Endereço</Label>
                <Input id="address" name="address" defaultValue={editingStudent?.address} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian">Responsável</Label>
                <Input id="guardian" name="guardian" defaultValue={editingStudent?.guardian} placeholder="Nome do pai/mãe para menores" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enrollmentDate">Data de Ingresso</Label>
                <Input id="enrollmentDate" name="enrollmentDate" type="date" defaultValue={editingStudent?.enrollmentDate ? new Date(editingStudent.enrollmentDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]} />
              </div>
              <div className="sm:col-span-2 flex gap-6 pt-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary transition-colors">
                  <input type="checkbox" name="baptized" defaultChecked={editingStudent?.baptized} className="rounded accent-primary" />
                  Batizado
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary transition-colors">
                  <input type="checkbox" name="member" defaultChecked={editingStudent?.member} className="rounded accent-primary" />
                  Membro
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary transition-colors">
                  <input type="checkbox" name="newConvert" defaultChecked={editingStudent?.newConvert} className="rounded accent-primary" />
                  Novo Convertido
                </label>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="observations">Observações</Label>
                <Textarea id="observations" name="observations" defaultValue={editingStudent?.observations} className="min-h-[80px]" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingStudent ? "Salvar Alterações" : "Cadastrar Aluno"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-center">Confirmar Exclusão</DialogTitle>
            <DialogDescription className="text-center">
              Tem certeza que deseja excluir este aluno? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-center gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="flex-1">Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
