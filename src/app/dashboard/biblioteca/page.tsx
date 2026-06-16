"use client";

import React, { useState, useEffect } from "react";
import { 
  FileDown, Loader2, Plus, Trash2, Search, Filter, 
  BookOpen, Book, FileText, File, FolderArchive, ArrowUpRight, X, Link, Upload, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface ClassItem {
  id: string;
  name: string;
}

interface Material {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  category: string;
  classId: string | null;
  class: { id: string; name: string } | null;
  createdAt: string;
}

export default function BibliotecaPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "APOIO";
  const isAdmin = userRole === "ADMIN";

  const [materials, setMaterials] = useState<Material[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedClass, setSelectedClass] = useState("Todas");

  // Estados dos Diálogos
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  
  // Estado de Exclusão
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modo de upload: "file" (upload direto) ou "link" (link externo do Google Drive)
  const [uploadMode, setUploadMode] = useState<"file" | "link">("link");
  const [externalUrl, setExternalUrl] = useState("");

  // Dados do formulário de novo material
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Revista",
    classId: "none",
  });
  const [uploadedFile, setUploadedFile] = useState<{
    url: string;
    name: string;
    size: number;
  } | null>(null);

  useEffect(() => {
    fetchMaterials();
    fetchClasses();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/materials");
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      } else {
        toast.error("Erro ao carregar materiais");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes");
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
      }
    } catch (err) {
      console.error("Erro ao carregar classes:", err);
    }
  };

  // Upload do arquivo via FormData para o servidor
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limite de 4MB (limite do Vercel serverless)
    const maxSize = 4 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`O arquivo é muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite máximo de 4MB.`);
      return;
    }

    setUploadProgress(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/materials/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || `Erro no upload (HTTP ${res.status})`);
      }

      if (data?.url) {
        setUploadedFile({
          url: data.url,
          name: file.name,
          size: file.size,
        });
        toast.success("Arquivo carregado com sucesso!");
      } else {
        throw new Error("Não foi possível obter a URL do arquivo");
      }
    } catch (err: any) {
      console.error("Erro no upload:", err);
      toast.error(`Erro ao enviar arquivo: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setUploadProgress(false);
    }
  };

  // Helpers para identificar links externos
  const isExternalLink = (url: string) => {
    return url.includes("drive.google.com") || url.includes("docs.google.com") || url.includes("dropbox.com") || url.includes("onedrive.live.com") || url.startsWith("http") && !url.includes("blob.vercel-storage.com");
  };

  const isGoogleDriveLink = (url: string) => {
    return url.includes("drive.google.com") || url.includes("docs.google.com");
  };

  // Resetar formulário ao fechar dialog
  const resetForm = () => {
    setFormData({ title: "", description: "", category: "Revista", classId: "none" });
    setUploadedFile(null);
    setExternalUrl("");
    setUploadMode("link");
  };

  // Salvar registro do material no banco de dados
  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("O título é obrigatório");
      return;
    }

    // Validar conforme modo
    if (uploadMode === "file" && !uploadedFile) {
      toast.error("Você precisa selecionar e fazer o upload de um arquivo");
      return;
    }
    if (uploadMode === "link" && !externalUrl.trim()) {
      toast.error("Você precisa informar o link do material");
      return;
    }
    if (uploadMode === "link") {
      try {
        new URL(externalUrl.trim());
      } catch {
        toast.error("O link informado não é uma URL válida");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const isLink = uploadMode === "link";
      const payload = {
        title: formData.title,
        description: formData.description || null,
        fileUrl: isLink ? externalUrl.trim() : uploadedFile!.url,
        fileName: isLink ? formData.title : uploadedFile!.name,
        fileSize: isLink ? 0 : uploadedFile!.size,
        category: formData.category,
        classId: formData.classId === "none" ? null : formData.classId,
      };

      const res = await fetch("/api/materials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Material adicionado com sucesso!");
        setIsUploadOpen(false);
        resetForm();
        fetchMaterials();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Erro ao salvar");
      }
    } catch (err: any) {
      console.error("Erro ao salvar material:", err);
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmar exclusão do material
  const handleDeleteMaterial = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/materials/${deleteId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Material excluído com sucesso!");
        setDeleteId(null);
        fetchMaterials();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Erro ao excluir");
      }
    } catch (err: any) {
      console.error("Erro ao excluir material:", err);
      toast.error(`Erro ao excluir: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Auxiliares
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Revista":
        return <FileText className="h-6 w-6 text-purple-500" />;
      case "Lição":
        return <BookOpen className="h-6 w-6 text-blue-500" />;
      case "Livro":
        return <Book className="h-6 w-6 text-orange-500" />;
      case "Compactado":
      case "Zip":
        return <FolderArchive className="h-6 w-6 text-amber-500" />;
      default:
        return <File className="h-6 w-6 text-gray-500" />;
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "Revista":
        return "bg-purple-50 border-purple-200 text-purple-700";
      case "Lição":
        return "bg-blue-50 border-blue-200 text-blue-700";
      case "Livro":
        return "bg-orange-50 border-orange-200 text-orange-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  // Filtragem local dos materiais
  const filteredMaterials = materials.filter((material) => {
    const matchesSearch = 
      material.title.toLowerCase().includes(search.toLowerCase()) || 
      (material.description || "").toLowerCase().includes(search.toLowerCase()) ||
      material.fileName.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = selectedCategory === "Todas" || material.category === selectedCategory;

    const matchesClass = 
      selectedClass === "Todas" || 
      (selectedClass === "Geral" && !material.classId) || 
      material.classId === selectedClass;

    return matchesSearch && matchesCategory && matchesClass;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FileDown className="h-6 w-6 text-primary" />
            Biblioteca de Materiais
          </h1>
          <p className="page-subtitle">Revistas, lições em PDF e materiais de apoio para baixar</p>
        </div>
        
        {isAdmin && (
          <Button onClick={() => setIsUploadOpen(true)} className="premium-button w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Novo Material
          </Button>
        )}
      </div>

      {/* Barra de Filtros */}
      <Card className="border-none shadow-premium bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por título ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-gray-50/50 border-gray-200 focus:bg-white rounded-xl transition-all"
            />
          </div>

          {/* Categorias */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="bg-gray-50/50 border-gray-200 rounded-xl">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas as Categorias</SelectItem>
                <SelectItem value="Revista">Revistas</SelectItem>
                <SelectItem value="Lição">Lições</SelectItem>
                <SelectItem value="Livro">Livros</SelectItem>
                <SelectItem value="Outro">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Classes */}
          <div className="flex items-center gap-2">
            <GraduationCapIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="bg-gray-50/50 border-gray-200 rounded-xl">
                <SelectValue placeholder="Destinado a" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas as Classes</SelectItem>
                <SelectItem value="Geral">Geral (Sem classe específica)</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Grid de Materiais */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-500 font-medium">Buscando biblioteca de arquivos...</p>
        </div>
      ) : filteredMaterials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMaterials.map((material) => {
            const isDriveLink = isGoogleDriveLink(material.fileUrl);
            const isExternal = isExternalLink(material.fileUrl);
            return (
            <Card key={material.id} className="border border-gray-100 shadow-premium bg-white flex flex-col justify-between overflow-hidden relative group hover:shadow-md transition-all duration-300">
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className={`h-12 w-12 rounded-xl border flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${isDriveLink ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
                    {isDriveLink ? (
                      <svg className="h-6 w-6" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                        <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                        <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                        <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l11.902 23.8z" fill="#ea4335"/>
                        <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                        <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                        <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.8h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                      </svg>
                    ) : getCategoryIcon(material.category)}
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {isDriveLink && (
                      <Badge variant="outline" className="font-semibold border border-blue-200 bg-blue-50 text-blue-700">
                        Google Drive
                      </Badge>
                    )}
                    {isExternal && !isDriveLink && (
                      <Badge variant="outline" className="font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700">
                        Link Externo
                      </Badge>
                    )}
                    <Badge variant="outline" className={`font-semibold border ${getCategoryBadgeColor(material.category)}`}>
                      {material.category}
                    </Badge>
                    <Badge variant="secondary" className="font-semibold bg-gray-100 text-gray-700">
                      {material.class?.name || "Geral"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-2" title={material.title}>
                    {material.title}
                  </h3>
                  {material.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {material.description}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 font-medium">
                  {material.fileSize > 0 ? (
                    <span>Tam: {formatBytes(material.fileSize)}</span>
                  ) : (
                    <span>{isDriveLink ? "Google Drive" : isExternal ? "Link externo" : "—"}</span>
                  )}
                  <span>Enviado: {new Date(material.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex gap-2 border-t border-gray-100">
                <Button 
                  asChild
                  variant="default" 
                  className={`flex-1 rounded-xl shadow-sm text-white ${
                    isDriveLink 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-primary hover:bg-primary/95'
                  }`}
                >
                  <a href={material.fileUrl} target="_blank" rel="noopener noreferrer">
                    {isDriveLink ? (
                      <><ExternalLink className="h-4 w-4 mr-2" /> Abrir no Google Drive</>
                    ) : isExternal ? (
                      <><ExternalLink className="h-4 w-4 mr-2" /> Abrir Link</>
                    ) : (
                      <><ArrowUpRight className="h-4 w-4 mr-2" /> Baixar Arquivo</>
                    )}
                  </a>
                </Button>

                {isAdmin && (
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-xl border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 bg-white"
                    onClick={() => setDeleteId(material.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          );})}
        </div>
      ) : (
        <Card className="border-none shadow-premium bg-white py-16 text-center">
          <CardContent className="flex flex-col items-center justify-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
              <FileDown className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Nenhum material encontrado</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
                Não há materiais disponíveis no momento ou os filtros aplicados não retornaram resultados.
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => setIsUploadOpen(true)} variant="outline" className="mt-2 rounded-xl">
                Adicionar Primeiro Arquivo
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog para Upload de Novo Material */}
      <Dialog open={isUploadOpen} onOpenChange={(open) => { setIsUploadOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">Novo Material para Biblioteca</DialogTitle>
            <DialogDescription>Cadastre revistas, lições ou livros para download</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveMaterial} className="space-y-4 pt-3">
            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title" className="font-bold">Título do Material</Label>
              <Input
                id="title"
                placeholder="Ex: Revista 1º Trimestre 2026 - Adultos"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="rounded-lg h-11"
              />
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label htmlFor="description" className="font-bold">Descrição / Observações (Opcional)</Label>
              <Textarea
                id="description"
                placeholder="Uma breve descrição sobre o conteúdo do material..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="rounded-lg resize-none min-h-[70px]"
              />
            </div>

            {/* Grid Categoria / Classe */}
            <div className="grid grid-cols-2 gap-4">
              {/* Categoria */}
              <div className="space-y-2">
                <Label htmlFor="category" className="font-bold">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger className="h-11 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Revista">Revista</SelectItem>
                    <SelectItem value="Lição">Lição</SelectItem>
                    <SelectItem value="Livro">Livro</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Classe */}
              <div className="space-y-2">
                <Label htmlFor="classId" className="font-bold">Classe Destinada</Label>
                <Select
                  value={formData.classId}
                  onValueChange={(val) => setFormData({ ...formData, classId: val })}
                >
                  <SelectTrigger className="h-11 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geral (Todas as classes)</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Modo de Origem do Arquivo */}
            <div className="space-y-3 pt-2">
              <Label className="font-bold">Origem do Arquivo</Label>
              
              {/* Toggle entre Upload e Link */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setUploadMode("link"); setUploadedFile(null); }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 text-sm font-bold transition-all duration-200 ${
                    uploadMode === "link"
                      ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <Link className="h-4 w-4" />
                  Link Externo
                </button>
                <button
                  type="button"
                  onClick={() => { setUploadMode("file"); setExternalUrl(""); }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 text-sm font-bold transition-all duration-200 ${
                    uploadMode === "file"
                      ? "border-primary bg-green-50 text-green-700 shadow-sm"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  Upload (até 4MB)
                </button>
              </div>

              {/* Conteúdo do modo selecionado */}
              {uploadMode === "link" ? (
                /* Modo Link Externo (Google Drive, etc.) */
                <div className="space-y-2 animate-fade-in">
                  <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="h-8 w-8 rounded-lg bg-white border border-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="h-4 w-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                          <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                          <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                          <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l11.902 23.8z" fill="#ea4335"/>
                          <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                          <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                          <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.8h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-blue-800">Cole o link do Google Drive</p>
                        <p className="text-[10px] text-blue-600 mt-0.5 leading-relaxed">Ideal para arquivos grandes (acima de 4MB). O link precisa estar com compartilhamento público ativado.</p>
                      </div>
                    </div>
                    <Input
                      type="url"
                      placeholder="https://drive.google.com/drive/folders/..."
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      className="rounded-lg h-11 bg-white border-blue-200 focus:border-blue-400 text-sm"
                    />
                    {externalUrl && (
                      <div className="flex items-center gap-1.5 animate-fade-in">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                        <p className="text-[10px] text-green-700 font-semibold">Link pronto para salvar</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Modo Upload Direto */
                <div className="animate-fade-in">
                  {uploadedFile ? (
                    <div className="border border-green-200 bg-green-50/50 p-4 rounded-xl flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-green-900 truncate">{uploadedFile.name}</p>
                          <p className="text-[10px] text-green-600 font-medium">Tamanho: {formatBytes(uploadedFile.size)}</p>
                        </div>
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-green-700 hover:bg-green-100 hover:text-green-800 rounded-full"
                        onClick={() => setUploadedFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center bg-gray-50/50 flex flex-col items-center justify-center gap-2 relative hover:bg-gray-50 hover:border-gray-300 transition-all">
                      {uploadProgress ? (
                        <>
                          <Loader2 className="h-8 w-8 text-primary animate-spin" />
                          <p className="text-xs text-gray-500 font-semibold mt-1">Carregando arquivo...</p>
                        </>
                      ) : (
                        <>
                          <FileDown className="h-8 w-8 text-gray-400" />
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500 font-bold">Clique para fazer upload</p>
                            <p className="text-[10px] text-gray-400">PDF, Word, Excel, Powerpoint ou ZIP. Máx 4MB</p>
                          </div>
                          <Input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.epub,.zip,.rar"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={handleFileChange}
                            disabled={uploadProgress}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé Dialog */}
            <DialogFooter className="gap-2 sm:gap-0 pt-3">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsUploadOpen(false)} 
                disabled={isSubmitting}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={
                  isSubmitting || uploadProgress || 
                  (uploadMode === "file" && !uploadedFile) ||
                  (uploadMode === "link" && !externalUrl.trim())
                } 
                className="premium-button min-w-[140px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  "Adicionar à Biblioteca"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">Deseja realmente excluir?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá permanentemente o material da biblioteca do banco de dados e o arquivo do armazenamento em nuvem. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" onClick={() => setDeleteId(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMaterial}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-2" />
                  Excluindo...
                </>
              ) : (
                "Sim, Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Pequeno ícone auxiliar para o GraduationCap para evitar erros de importação complexa
function GraduationCapIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
    </svg>
  );
}
