"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Camera, Plus, Search, Filter, Loader2, Calendar, Image as ImageIcon,
  Trash2, Edit, X, Save, Crown, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface Album {
  id: string;
  title: string;
  description: string | null;
  date: string;
  type: string;
  classId: string | null;
  className: string;
  coverUrl: string | null;
  photoCount: number;
  createdById: string | null;
}

interface PhotoItem {
  id: string;
  url: string;
  caption: string | null;
}

interface AlbumDetail {
  id: string;
  title: string;
  description: string | null;
  date: string;
  type: string;
  classId: string | null;
  class: { name: string } | null;
  photos: PhotoItem[];
  createdById: string | null;
}

interface ClassItem { id: string; name: string; }

const typeLabels: Record<string, string> = { aula: "Aula", evento: "Evento", outro: "Outro" };
const typeColors: Record<string, string> = {
  aula: "bg-blue-100 text-blue-700",
  evento: "bg-purple-100 text-purple-700",
  outro: "bg-gray-100 text-gray-600",
};

export default function FotosPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "";
  const userId = (session?.user as any)?.id || "";
  const isAdmin = userRole === "ADMIN";

  const [albums, setAlbums] = useState<Album[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState("Todas");
  const [filterType, setFilterType] = useState("Todos");
  const [search, setSearch] = useState("");

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newType, setNewType] = useState("aula");
  const [newClassId, setNewClassId] = useState("none");
  const [pendingPhotos, setPendingPhotos] = useState<{ url: string; caption: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detail view
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [addingPhotos, setAddingPhotos] = useState(false);
  const addFileRef = useRef<HTMLInputElement>(null);

  // Delete confirm
  const [deleteAlbumId, setDeleteAlbumId] = useState<string | null>(null);
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [albumsRes, classesRes] = await Promise.all([
        fetch("/api/photos"), fetch("/api/classes")
      ]);
      setAlbums(await albumsRes.json());
      setClasses(await classesRes.json());
    } catch { toast.error("Erro ao carregar dados"); }
    finally { setLoading(false); }
  }

  async function fetchAlbums() {
    const params = new URLSearchParams();
    if (filterClass !== "Todas") params.set("classId", filterClass);
    if (filterType !== "Todos") params.set("type", filterType);
    const res = await fetch(`/api/photos?${params}`);
    setAlbums(await res.json());
  }

  useEffect(() => { if (!loading) fetchAlbums(); }, [filterClass, filterType]);

  const handleUploadFiles = async (files: FileList) => {
    setUploading(true);
    const newPhotos: { url: string; caption: string }[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 4 * 1024 * 1024) {
        toast.error(`${file.name} excede 4MB`);
        continue;
      }
      try {
        const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const data = await res.json();
        if (data.url) newPhotos.push({ url: data.url, caption: "" });
        else toast.error(`Erro ao enviar ${file.name}`);
      } catch { toast.error(`Falha ao enviar ${file.name}`); }
    }
    setUploading(false);
    return newPhotos;
  };

  const handleCreateFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const uploaded = await handleUploadFiles(files);
    setPendingPhotos(prev => [...prev, ...uploaded]);
    e.target.value = "";
  };

  const handleSaveAlbum = async () => {
    if (!newTitle.trim()) { toast.error("Informe o título"); return; }
    if (pendingPhotos.length === 0) { toast.error("Adicione pelo menos uma foto"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle, description: newDesc, date: newDate,
          type: newType, classId: newClassId === "none" ? null : newClassId,
          photos: pendingPhotos,
        }),
      });
      if (res.ok) {
        toast.success("Álbum criado!");
        setShowCreate(false);
        resetCreateForm();
        fetchAlbums();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Erro ao criar");
      }
    } catch { toast.error("Erro de conexão"); }
    finally { setSaving(false); }
  };

  const resetCreateForm = () => {
    setNewTitle(""); setNewDesc(""); setNewDate(new Date().toISOString().split("T")[0]);
    setNewType("aula"); setNewClassId("none"); setPendingPhotos([]);
  };

  const openAlbum = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/photos/${id}`);
      if (res.ok) setSelectedAlbum(await res.json());
      else toast.error("Erro ao abrir álbum");
    } catch { toast.error("Erro de conexão"); }
    finally { setLoadingDetail(false); }
  };

  const handleAddPhotosToAlbum = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !selectedAlbum) return;
    setAddingPhotos(true);
    const uploaded = await handleUploadFiles(e.target.files);
    if (uploaded.length > 0) {
      const res = await fetch(`/api/photos/${selectedAlbum.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPhotos: uploaded }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedAlbum(updated);
        fetchAlbums();
        toast.success(`${uploaded.length} foto(s) adicionada(s)!`);
      }
    }
    setAddingPhotos(false);
    e.target.value = "";
  };

  const confirmDeleteAlbum = async () => {
    if (!deleteAlbumId) return;
    try {
      const res = await fetch(`/api/photos/${deleteAlbumId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Álbum excluído");
        setDeleteAlbumId(null);
        setSelectedAlbum(null);
        fetchAlbums();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Erro ao excluir");
      }
    } catch { toast.error("Erro de conexão"); }
  };

  const confirmDeletePhoto = async () => {
    if (!deletePhotoId || !selectedAlbum) return;
    try {
      const res = await fetch(`/api/photos/${selectedAlbum.id}/photos/${deletePhotoId}`, { method: "DELETE" });
      if (res.ok) {
        setSelectedAlbum({
          ...selectedAlbum,
          photos: selectedAlbum.photos.filter(p => p.id !== deletePhotoId),
        });
        setDeletePhotoId(null);
        fetchAlbums();
        toast.success("Foto excluída");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Erro ao excluir");
      }
    } catch { toast.error("Erro de conexão"); }
  };

  const filtered = albums.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.className.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Camera className="h-6 w-6 text-primary" /> Fotos da EBD
          </h1>
          <p className="page-subtitle">Álbum de registros das aulas, classes e eventos</p>
        </div>
        <Button onClick={() => { resetCreateForm(); setShowCreate(true); }} className="rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all">
          <Plus className="h-4 w-4 mr-2" /> Novo Álbum
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Buscar álbum..." className="pl-9 rounded-xl shadow-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-full sm:w-44 rounded-xl shadow-sm"><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas as Classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-36 rounded-xl shadow-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos os Tipos</SelectItem>
            <SelectItem value="aula">Aula</SelectItem>
            <SelectItem value="evento">Evento</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-500">Carregando álbuns...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <Camera className="h-16 w-16 mx-auto mb-4 text-gray-200" />
          <h3 className="text-lg font-bold text-gray-700">Nenhum álbum encontrado</h3>
          <p className="text-sm text-gray-400 mt-1">Crie um novo álbum para começar a registrar os momentos da EBD.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(album => (
            <Card
              key={album.id}
              className="group rounded-2xl border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden"
              onClick={() => openAlbum(album.id)}
            >
              <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                {album.coverUrl ? (
                  <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-gray-200" />
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <Badge className={cn("text-[10px] font-bold uppercase shadow-sm", typeColors[album.type] || typeColors.outro)}>
                    {typeLabels[album.type] || album.type}
                  </Badge>
                </div>
                <div className="absolute bottom-3 right-3">
                  <Badge className="bg-black/60 text-white text-[10px] font-bold backdrop-blur-sm">
                    <Camera className="h-3 w-3 mr-1" /> {album.photoCount}
                  </Badge>
                </div>
                {isAdmin && (
                  <button
                    className="absolute top-3 right-3 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                    onClick={e => { e.stopPropagation(); setDeleteAlbumId(album.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-bold text-gray-900 truncate">{album.title}</h3>
                <div className="flex items-center justify-between mt-2">
                  <Badge variant="outline" className="text-[10px] text-gray-500 font-medium">{album.className}</Badge>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {new Date(album.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Album Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" /> Novo Álbum de Fotos
            </DialogTitle>
            <DialogDescription>Registre os momentos da EBD com fotos das aulas e eventos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Título *</Label>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex: Aula sobre Fé - Adolescentes" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aula">Aula</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Classe</Label>
                <Select value={newClassId} onValueChange={setNewClassId}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geral / Todas</SelectItem>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descrição opcional..." className="rounded-xl min-h-[60px]" />
              </div>
            </div>

            {/* Photos section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">Fotos ({pendingPhotos.length})</Label>
                <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                  {uploading ? "Enviando..." : "Selecionar Fotos"}
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleCreateFiles} />
              </div>
              {pendingPhotos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {pendingPhotos.map((p, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden group bg-gray-100">
                      <img src={p.url} alt="" className="w-full h-full object-cover" />
                      <button
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setPendingPhotos(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSaveAlbum} disabled={saving} className="rounded-xl px-8">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : <><Save className="h-4 w-4 mr-2" /> Criar Álbum</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Album Detail Dialog */}
      <Dialog open={!!selectedAlbum} onOpenChange={() => setSelectedAlbum(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {loadingDetail ? (
            <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : selectedAlbum && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" />
                  {selectedAlbum.title}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-3 pt-1">
                  <Badge className={cn("text-[10px] font-bold uppercase", typeColors[selectedAlbum.type] || typeColors.outro)}>
                    {typeLabels[selectedAlbum.type] || selectedAlbum.type}
                  </Badge>
                  <span className="text-gray-400">•</span>
                  <span>{selectedAlbum.class?.name || "Geral"}</span>
                  <span className="text-gray-400">•</span>
                  <span>{new Date(selectedAlbum.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>
                </DialogDescription>
              </DialogHeader>
              {selectedAlbum.description && (
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">{selectedAlbum.description}</p>
              )}

              <div className="flex items-center justify-between pt-2">
                <p className="text-sm font-bold text-gray-500">{selectedAlbum.photos.length} foto(s)</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => addFileRef.current?.click()} disabled={addingPhotos}>
                    {addingPhotos ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    Adicionar Fotos
                  </Button>
                  <input ref={addFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotosToAlbum} />
                  {isAdmin && (
                    <Button variant="outline" size="sm" className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteAlbumId(selectedAlbum.id)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Excluir Álbum
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
                {selectedAlbum.photos.map(photo => (
                  <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden group bg-gray-100 cursor-pointer" onClick={() => setLightboxUrl(photo.url)}>
                    <img src={photo.url} alt={photo.caption || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {isAdmin && (
                      <button
                        className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        onClick={e => { e.stopPropagation(); setDeletePhotoId(photo.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white p-2"><X className="h-8 w-8" /></button>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Delete Album Confirm */}
      <Dialog open={!!deleteAlbumId} onOpenChange={() => setDeleteAlbumId(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-red-600">Excluir Álbum</DialogTitle>
            <DialogDescription className="text-center pt-4 text-sm">
              Tem certeza? <strong>Todas as fotos deste álbum serão removidas permanentemente.</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4 justify-center">
            <Button variant="outline" onClick={() => setDeleteAlbumId(null)} className="flex-1 rounded-xl">Cancelar</Button>
            <Button variant="destructive" onClick={confirmDeleteAlbum} className="flex-1 rounded-xl">Sim, Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Photo Confirm */}
      <Dialog open={!!deletePhotoId} onOpenChange={() => setDeletePhotoId(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-red-600">Excluir Foto</DialogTitle>
            <DialogDescription className="text-center pt-4 text-sm">Deseja remover esta foto do álbum?</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4 justify-center">
            <Button variant="outline" onClick={() => setDeletePhotoId(null)} className="flex-1 rounded-xl">Cancelar</Button>
            <Button variant="destructive" onClick={confirmDeletePhoto} className="flex-1 rounded-xl">Sim, Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
