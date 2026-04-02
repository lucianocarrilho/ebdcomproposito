"use client";

import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash2, GraduationCap, Users, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

interface ClassItem {
  id: string;
  name: string;
  description: string;
  audience: string;
  professor: string;
  dirigente: string;
  viceDirigente: string;
  active: boolean;
  _count?: {
    students: number;
  };
}

interface Leader {
  id: string;
  name: string;
  role: string;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Estados para os campos controlados (para facilitar o filtro e garantir o reset)
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAudience, setFormAudience] = useState("");
  const [formProfessor, setFormProfessor] = useState("");
  const [formDirigente, setFormDirigente] = useState("");
  const [formViceDirigente, setFormViceDirigente] = useState("");
  const [formActive, setFormActive] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData(silent = false) {
    try {
      if (!silent) setLoading(true);
      const [resClasses, resLeaders] = await Promise.all([
        fetch("/api/classes"),
        fetch(`/api/leaders?t=${Date.now()}`)
      ]);
      
      const dataClasses = await resClasses.json();
      const dataLeaders = await resLeaders.json();
      
      setClasses(Array.isArray(dataClasses) ? dataClasses : []);
      setLeaders(Array.isArray(dataLeaders) ? dataLeaders : []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes");
      const data = await res.json();
      setClasses(data);
    } catch (error) {
      console.error("Erro ao carregar classes:", error);
    }
  };

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isDialogOpen) {
      // Re-fetch data whenever the dialog opens to be sure we have the latest leaders
      fetchData(true);
      
      if (editingClass) {
        setFormName(editingClass.name || "");
        setFormDescription(editingClass.description || "");
        setFormAudience(editingClass.audience || "");
        setFormProfessor(editingClass.professor || "");
        setFormDirigente(editingClass.dirigente || "");
        setFormViceDirigente(editingClass.viceDirigente || "");
        setFormActive(editingClass.active !== undefined ? editingClass.active : true);
      } else {
        setFormName("");
        setFormDescription("");
        setFormAudience("");
        setFormProfessor("");
        setFormDirigente("");
        setFormViceDirigente("");
        setFormActive(true);
      }
    }
  }, [editingClass, isDialogOpen]);

  const filteredClasses = classes.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.audience.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    
    // O payload deve usar os estados controlados para garantir que salvamos o que está no input
    const payload = {
      name: formName,
      description: formDescription,
      audience: formAudience,
      professor: formProfessor,
      dirigente: formDirigente,
      viceDirigente: formViceDirigente,
      active: formActive,
    };

    try {
      const url = editingClass ? `/api/classes/${editingClass.id}` : "/api/classes";
      const method = editingClass ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchClasses();
        setIsDialogOpen(false);
        setEditingClass(null);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Erro ao salvar classe");
      }
    } catch (error) {
      console.error("Erro ao salvar classe:", error);
      alert("Erro de conexão ao salvar classe");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/classes/${id}`, { method: "DELETE" });
      if (res.ok) {
        setClasses(classes.filter((c) => c.id !== id));
        setDeleteConfirm(null);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Erro ao excluir classe");
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Erro ao deletar classe:", error);
      alert("Erro de conexão ao excluir classe");
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-gray-500">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p>Carregando classes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Classes</h1>
          <p className="page-subtitle">Gerencie as classes da Escola Bíblica Dominical</p>
        </div>
        <Button
          onClick={() => {
            setEditingClass(null);
            setIsDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nova Classe
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar classes..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid de Classes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClasses.map((cls, i) => (
          <Card key={cls.id} className="animate-slide-up hover:shadow-lg transition-shadow border-gray-100" style={{ animationDelay: `${i * 50}ms` }}>
            <CardHeader className="pb-3 border-b border-gray-50 bg-gray-50/30 rounded-t-xl">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-primary">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-primary" />
                  </div>
                  {cls.name}
                </CardTitle>
                <Badge variant={cls.active ? "success" : "secondary"}>
                  {cls.active ? "Ativa" : "Inativa"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <p className="text-sm text-gray-600 line-clamp-2 min-h-[40px] italic">
                {cls.description || "Sem descrição"}
              </p>
              <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                <div>
                  <p className="text-gray-400 font-medium">Público</p>
                  <p className="font-semibold text-gray-700">{cls.audience || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Alunos</p>
                  <p className="font-semibold text-gray-700 flex items-center gap-1">
                    <Users className="h-3 w-3" /> {cls._count?.students || 0}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Professor(a)</p>
                  <p className="font-semibold text-gray-700">{cls.professor || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Dirigente</p>
                  <p className="font-semibold text-gray-700">{cls.dirigente || "-"}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setEditingClass(cls);
                    setIsDialogOpen(true);
                  }}
                >
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  title="Excluir classe"
                  onClick={() => setDeleteConfirm(cls.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog - Nova/Editar Classe */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClass ? "Editar Classe" : "Nova Classe"}</DialogTitle>
            <DialogDescription>
              {editingClass
                ? "Atualize os dados da classe"
                : "Preencha os dados para criar uma nova classe"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Classe *</Label>
              <Input
                id="name"
                name="name"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Jovens, Mulheres, Crianças"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Breve descrição dos objetivos da classe"
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audience">Público Alvo</Label>
              <Input
                id="audience"
                name="audience"
                value={formAudience}
                onChange={(e) => setFormAudience(e.target.value)}
                placeholder="Ex: Jovens de 18 a 30 anos"
              />
            </div>

            {/* Professor(a) Principal */}
            <div className="space-y-2 relative">
              <Label htmlFor="professor">Professor(a) Principal</Label>
              <Input 
                id="professor" 
                name="professor" 
                value={formProfessor}
                onChange={(e) => setFormProfessor(e.target.value)}
                autoComplete="off"
                placeholder="Busque pelo nome..."
              />
              {formProfessor && !leaders.find(l => l.name === formProfessor) && (
                <div className="absolute z-[100] left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-200">
                  {leaders
                    .filter(l => l.name.toLowerCase().includes(formProfessor.toLowerCase()))
                    .map(l => (
                      <button
                        key={l.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 hover:text-primary transition-colors border-b border-gray-50 last:border-0"
                        onClick={() => setFormProfessor(l.name)}
                      >
                        <div className="font-medium">{l.name}</div>
                        <div className="text-[10px] text-gray-400 uppercase">{l.role}</div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Dirigente */}
              <div className="space-y-2 relative">
                <Label htmlFor="dirigente">Dirigente</Label>
                <Input 
                  id="dirigente" 
                  name="dirigente" 
                  value={formDirigente}
                  onChange={(e) => setFormDirigente(e.target.value)}
                  autoComplete="off"
                  placeholder="Busque..."
                />
                {formDirigente && !leaders.find(l => l.name === formDirigente) && (
                  <div className="absolute z-[100] left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl">
                    {leaders
                      .filter(l => l.name.toLowerCase().includes(formDirigente.toLowerCase()))
                      .map(l => (
                        <button
                          key={l.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 hover:text-primary"
                          onClick={() => setFormDirigente(l.name)}
                        >
                          <div className="font-medium">{l.name}</div>
                          <div className="text-[10px] text-gray-400 uppercase">{l.role}</div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              
              {/* Vice-Dirigente */}
              <div className="space-y-2 relative">
                <Label htmlFor="viceDirigente">Vice-Dirigente</Label>
                <Input 
                  id="viceDirigente" 
                  name="viceDirigente" 
                  value={formViceDirigente}
                  onChange={(e) => setFormViceDirigente(e.target.value)}
                  autoComplete="off"
                  placeholder="Busque..."
                />
                {formViceDirigente && !leaders.find(l => l.name === formViceDirigente) && (
                  <div className="absolute z-[100] left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl">
                    {leaders
                      .filter(l => l.name.toLowerCase().includes(formViceDirigente.toLowerCase()))
                      .map(l => (
                        <button
                          key={l.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 hover:text-primary"
                          onClick={() => setFormViceDirigente(l.name)}
                        >
                          <div className="font-medium">{l.name}</div>
                          <div className="text-[10px] text-gray-400 uppercase">{l.role}</div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingClass ? "Salvar Alterações" : "Criar Classe"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Exclusão */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-red-600">Confirmar Exclusão</DialogTitle>
            <DialogDescription className="text-center pt-2">
              Tem certeza que deseja excluir esta classe? <br/>
              <strong>Esta ação removerá permanentemente a classe do sistema.</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4 justify-center">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Sim, Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
