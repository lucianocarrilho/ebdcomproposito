"use client";

import React, { useState } from "react";
import { Plus, Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  date: string;
  reason: string;
  observations: string;
  registeredBy: string;
}

const initialData: Justification[] = [
  { id: "1", studentName: "Ana Paula Ferreira", date: "16/03/2026", reason: "Viagem de trabalho", observations: "Avisou com antecedência", registeredBy: "Irmã Juliana" },
  { id: "2", studentName: "Pedro Henrique Costa", date: "09/03/2026", reason: "Consulta médica", observations: "Atestado apresentado", registeredBy: "Irmão Carlos" },
  { id: "3", studentName: "Carlos Eduardo Souza", date: "02/03/2026", reason: "Compromisso familiar", observations: "", registeredBy: "Irmão Roberto" },
  { id: "4", studentName: "Juliana Rodrigues", date: "23/02/2026", reason: "Doença", observations: "Resfriado forte", registeredBy: "Irmã Raquel" },
];

export default function JustificativasPage() {
  const [justifications, setJustifications] = useState(initialData);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filtered = justifications.filter(j =>
    j.studentName.toLowerCase().includes(search.toLowerCase()) ||
    j.reason.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setJustifications([...justifications, {
      id: String(Date.now()),
      studentName: fd.get("studentName") as string,
      date: fd.get("date") as string,
      reason: fd.get("reason") as string,
      observations: fd.get("observations") as string,
      registeredBy: fd.get("registeredBy") as string,
    }]);
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Justificativas</h1>
          <p className="page-subtitle">Registro de faltas justificadas</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Nova Justificativa
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Buscar..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Aluno</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="hidden md:table-cell">Motivo</TableHead>
                <TableHead className="hidden lg:table-cell">Observações</TableHead>
                <TableHead className="hidden lg:table-cell">Registrado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(j => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.studentName}</TableCell>
                  <TableCell><Badge variant="secondary">{j.date}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell">{j.reason}</TableCell>
                  <TableCell className="hidden lg:table-cell text-gray-500">{j.observations || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-gray-500">{j.registeredBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Nenhuma justificativa encontrada</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Justificativa</DialogTitle>
            <DialogDescription>Registre uma justificativa de falta</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentName">Aluno</Label>
              <Input id="studentName" name="studentName" required placeholder="Nome do aluno" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data da Falta</Label>
              <Input id="date" name="date" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo</Label>
              <Input id="reason" name="reason" required placeholder="Motivo da justificativa" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="observations">Observações</Label>
              <Textarea id="observations" name="observations" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registeredBy">Registrado por</Label>
              <Input id="registeredBy" name="registeredBy" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Registrar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
