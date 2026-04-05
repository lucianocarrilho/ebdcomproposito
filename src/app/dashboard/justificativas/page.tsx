"use client";

import React, { useState, useEffect } from "react";
import { Plus, Search, FileText, Loader2, User } from "lucide-react";
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

interface Justification {
  id: string;
  studentName: string;
  className: string;
  date: string;
  reason: string;
  observations: string;
  registeredBy: string;
}

export default function JustificativasPage() {
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJustifications();
  }, []);

  async function fetchJustifications() {
    try {
      setLoading(true);
      const res = await fetch("/api/justifications");
      if (res.ok) {
        const data = await res.json();
        setJustifications(data);
      }
    } catch (error) {
      console.error("Erro ao buscar justificativas:", error);
    } finally {
      setLoading(false);
    }
  }

  const filtered = justifications.filter(j =>
    j.studentName.toLowerCase().includes(search.toLowerCase()) ||
    j.reason.toLowerCase().includes(search.toLowerCase()) ||
    j.className?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Justificativas</h1>
          <p className="page-subtitle">Registro de faltas justificadas das classes</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all">
          <Plus className="h-4 w-4 mr-2" /> Nova Justificativa
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Buscar por aluno, motivo ou classe..." className="pl-9 rounded-xl border-gray-100 shadow-sm" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card className="rounded-3xl border-gray-100 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 border-b border-gray-100">
                <TableHead className="font-bold text-gray-600">Aluno</TableHead>
                <TableHead className="font-bold text-gray-600">Data</TableHead>
                <TableHead className="hidden md:table-cell font-bold text-gray-600">Classe</TableHead>
                <TableHead className="hidden md:table-cell font-bold text-gray-600">Motivo</TableHead>
                <TableHead className="hidden lg:table-cell font-bold text-gray-600">Registrado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-gray-400">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-medium">Carregando justificativas...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.map(j => (
                <TableRow key={j.id} className="hover:bg-gray-50/30 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {j.studentName.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </div>
                      <span className="font-bold text-gray-700">{j.studentName}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 font-bold">{j.date}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-gray-500 font-medium">{j.className}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell font-medium text-gray-600">{j.reason}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                      <User className="h-3 w-3" /> {j.registeredBy}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {!loading && filtered.length === 0 && (
            <div className="text-center py-20 bg-gray-50/20">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-10 w-10 text-gray-300" />
              </div>
              <p className="text-gray-500 font-bold text-lg">Nenhuma justificativa recente</p>
              <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
                No momento não existem registros de faltas justificadas para os alunos das suas turmas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary">Nova Justificativa</DialogTitle>
            <DialogDescription className="text-sm">Registre uma justificativa manual de um aluno.</DialogDescription>
          </DialogHeader>
          <div className="p-12 text-center text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
            <p className="text-xs italic">O registro manual está sendo migrado para o fluxo de Chamada de Presença.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-full">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
