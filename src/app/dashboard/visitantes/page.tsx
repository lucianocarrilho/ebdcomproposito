"use client";

import React, { useState } from "react";
import { Plus, Search, UserPlus, Trophy, Gift, Check } from "lucide-react";
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

interface VisitorRecord {
  id: string;
  visitorName: string;
  date: string;
  className: string;
  invitedBy: string;
  observations: string;
}

const initialVisitors: VisitorRecord[] = [
  { id: "1", visitorName: "Carla Mendes", date: "23/03/2026", className: "Mulheres", invitedBy: "Maria Silva", observations: "Primeira visita" },
  { id: "2", visitorName: "Fernanda Lima", date: "16/02/2026", className: "Mulheres", invitedBy: "Maria Silva", observations: "" },
  { id: "3", visitorName: "Patrícia Souza", date: "02/02/2026", className: "Mulheres", invitedBy: "Maria Silva", observations: "Vizinha da Maria" },
  { id: "4", visitorName: "Bruno Costa", date: "16/03/2026", className: "Jovens", invitedBy: "Ana Paula", observations: "" },
  { id: "5", visitorName: "Diego Santos", date: "09/03/2026", className: "Jovens", invitedBy: "Ana Paula", observations: "" },
  { id: "6", visitorName: "Elisa Ferreira", date: "02/03/2026", className: "Jovens", invitedBy: "Lucas Oliveira", observations: "" },
  { id: "7", visitorName: "Ricardo Almeida", date: "23/02/2026", className: "Homens", invitedBy: "João Santos", observations: "Colega de trabalho" },
  { id: "8", visitorName: "Sandra Oliveira", date: "16/02/2026", className: "Mulheres", invitedBy: "Juliana Rodrigues", observations: "" },
];

const rankingMissionario = [
  { nome: "Maria Silva", visitantes: 3, classe: "Mulheres", mimoEntregue: true },
  { nome: "Ana Paula", visitantes: 2, classe: "Jovens", mimoEntregue: false },
  { nome: "João Santos", visitantes: 1, classe: "Homens", mimoEntregue: false },
  { nome: "Lucas Oliveira", visitantes: 1, classe: "Jovens", mimoEntregue: false },
  { nome: "Juliana Rodrigues", visitantes: 1, classe: "Mulheres", mimoEntregue: false },
];

export default function VisitantesPage() {
  const [visitors, setVisitors] = useState(initialVisitors);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const filtered = visitors.filter(v =>
    v.visitorName.toLowerCase().includes(search.toLowerCase()) ||
    v.invitedBy.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setVisitors([...visitors, {
      id: String(Date.now()),
      visitorName: fd.get("visitorName") as string,
      date: new Date(fd.get("date") as string).toLocaleDateString("pt-BR"),
      className: fd.get("className") as string,
      invitedBy: fd.get("invitedBy") as string,
      observations: fd.get("observations") as string,
    }]);
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Visitantes</h1>
          <p className="page-subtitle">{visitors.length} visitantes registrados</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Registrar Visitante
        </Button>
      </div>

      {/* Aluno Missionário */}
      <Card className="border-primary/20 bg-gradient-to-r from-blue-50 to-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
              <Trophy className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-xs text-primary font-medium uppercase tracking-wider">🏆 Aluno Missionário do Trimestre</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">Maria Silva</p>
              <p className="text-sm text-gray-500">3 visitantes trazidos • Classe Mulheres</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent" />
            Ranking Missionário - 1º Trimestre 2026
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rankingMissionario.map((r, i) => (
              <div key={r.nome} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                    i === 0 ? "bg-accent" : i === 1 ? "bg-gray-400" : "bg-gray-300"
                  }`}>
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{r.nome}</p>
                    <p className="text-xs text-gray-500">{r.classe}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{r.visitantes}</p>
                    <p className="text-[10px] text-gray-500">visitantes</p>
                  </div>
                  {r.mimoEntregue ? (
                    <Badge variant="success"><Gift className="h-3 w-3 mr-1" />Mimo entregue</Badge>
                  ) : (
                    <Badge variant="secondary">Pendente</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Buscar visitante..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Todos os Visitantes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Visitante</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="hidden md:table-cell">Classe</TableHead>
                <TableHead className="hidden md:table-cell">Convidado por</TableHead>
                <TableHead className="hidden lg:table-cell">Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(v => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{v.visitorName}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{v.date}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell">{v.className}</TableCell>
                  <TableCell className="hidden md:table-cell text-primary font-medium">{v.invitedBy}</TableCell>
                  <TableCell className="hidden lg:table-cell text-gray-500">{v.observations || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Visitante</DialogTitle>
            <DialogDescription>Adicione um novo visitante</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="visitorName">Nome do Visitante</Label>
              <Input id="visitorName" name="visitorName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" name="date" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="className">Classe</Label>
              <Input id="className" name="className" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invitedBy">Convidado por (Aluno)</Label>
              <Input id="invitedBy" name="invitedBy" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="observations">Observações</Label>
              <Textarea id="observations" name="observations" />
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
