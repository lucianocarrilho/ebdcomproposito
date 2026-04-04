"use client";

import React, { useState, useEffect } from "react";
import { Plus, Search, UserPlus, Trophy, Gift, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function VisitantesPage() {
  const [visitors, setVisitors] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
    loadFormOptions();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/visitors");
      const json = await res.json();
      setVisitors(json.visitors || []);
      setRanking(json.ranking || []);
    } catch (err) {
      toast.error("Erro ao carregar dados");
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
      console.error("Erro ao carregar opções do formulário");
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    
    const payload = {
      name: fd.get("visitorName"),
      date: fd.get("date"),
      classId: fd.get("classId"),
      invitedById: fd.get("invitedById") || null,
      observations: fd.get("observations"),
    };

    try {
      const res = await fetch("/api/visitors", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Visitante registrado com sucesso!");
        setIsDialogOpen(false);
        fetchData(); // Refresh list and ranking
      } else {
        throw new Error();
      }
    } catch (err) {
      toast.error("Erro ao registrar visitante");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = visitors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.invitedBy?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Visitantes</h1>
          <p className="page-subtitle">{visitors.length} visitantes registrados</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className=" premium-button">
          <Plus className="h-4 w-4 mr-2" /> Registrar Visitante
        </Button>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-gray-500">Sincronizando dados...</p>
        </div>
      ) : (
        <>
          {/* Aluno Missionário do Trimestre */}
          {ranking.length > 0 && (
            <Card className="border-none shadow-premium bg-gradient-to-br from-primary/5 via-white to-white overflow-hidden relative">
              <div className="absolute right-0 top-0 p-4 opacity-5 pointer-events-none">
                <Trophy className="h-32 w-32 rotate-12" />
              </div>
              <CardContent className="p-6 relative z-10">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center shadow-inner">
                    <Trophy className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none mb-1 text-[10px] font-bold uppercase tracking-widest">
                      🏆 Liderança Missionária
                    </Badge>
                    <p className="text-2xl font-extrabold text-gray-900 leading-tight">{ranking[0].nome}</p>
                    <p className="text-sm text-gray-500 font-medium">{ranking[0].visitantes} visitantes trazidos • Classe {ranking[0].classe}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ranking */}
            <Card className="border-none shadow-premium h-fit">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-accent" />
                  Ranking Missionário
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {ranking.map((r, i) => (
                    <div key={r.nome} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 border border-gray-100 hover:bg-white hover:shadow-md transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm ${
                          i === 0 ? "bg-accent" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-amber-600" : "bg-gray-300"
                        }`}>
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{r.nome}</p>
                          <p className="text-[10px] text-gray-500 uppercase font-medium">{r.classe}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-md font-extrabold text-primary">{r.visitantes}</p>
                        </div>
                        <UserPlus className="h-4 w-4 text-primary/20" />
                      </div>
                    </div>
                  ))}
                  {ranking.length === 0 && (
                    <p className="text-sm text-center text-gray-400 py-4 italic">Nenhum convidado registrado ainda.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Visitors Table */}
            <div className="lg:col-span-2 space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Buscar visitante ou quem convidou..." className="pl-9 h-11 border-none shadow-premium rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
              </div>

              <Card className="border-none shadow-premium overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50 border-b border-gray-100">
                        <TableHead className="font-bold text-gray-900 uppercase text-[10px] tracking-widest">Visitante</TableHead>
                        <TableHead className="font-bold text-gray-900 uppercase text-[10px] tracking-widest text-center">Data</TableHead>
                        <TableHead className="hidden md:table-cell font-bold text-gray-900 uppercase text-[10px] tracking-widest">Classe</TableHead>
                        <TableHead className="hidden md:table-cell font-bold text-gray-900 uppercase text-[10px] tracking-widest">Convidado por</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(v => (
                        <TableRow key={v.id} className="hover:bg-gray-50/30 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                                <User className="h-5 w-5 text-blue-500" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{v.name}</p>
                                <p className="text-[10px] text-gray-500 line-clamp-1 italic">{v.observations || "Sem observações"}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="font-bold border-gray-200">
                              {new Date(v.date).toLocaleDateString("pt-BR")}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none">
                              {v.class?.name}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell font-bold text-primary">
                            {v.invitedBy?.name || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-10 text-gray-400">
                            Nenhum visitante encontrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Register Visitor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-gray-900">Registrar Visitante</DialogTitle>
            <DialogDescription>Preencha os dados do novo convidado</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label htmlFor="visitorName" className="font-bold">Nome do Visitante</Label>
              <Input id="visitorName" name="visitorName" required className="h-11 rounded-lg" placeholder="Nome completo" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="font-bold">Data da Visita</Label>
                <Input id="date" name="date" type="date" required className="h-11 rounded-lg" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="classId" className="font-bold">Em qual Classe?</Label>
                <Select name="classId" required>
                  <SelectTrigger className="h-11 rounded-lg">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invitedById" className="font-bold">Convidado por qual Aluno?</Label>
              <Select name="invitedById">
                <SelectTrigger className="h-11 rounded-lg">
                  <SelectValue placeholder="Selecione o aluno (opcional)" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  <SelectItem value="none">Ninguém (visita espontânea)</SelectItem>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.class?.name})</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-gray-400">Isso somará pontos no Ranking Missionário para o aluno.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observations" className="font-bold">Observações / Contato</Label>
              <Textarea id="observations" name="observations" className="rounded-lg resize-none" placeholder="Ex: Visitou pela 1ª vez, gostou da aula de jovens..." />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={submitting}>Cancelar</Button>
              <Button type="submit" disabled={submitting} className="premium-button min-w-[120px]">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
