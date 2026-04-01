"use client";

import React, { useState } from "react";
import { Plus, Star, Trophy, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const destaques = [
  { id: "1", studentName: "Maria Silva Oliveira", className: "Mulheres", quarter: "2026-Q1", reason: "100% de frequência e participação exemplar", date: "30/03/2026", type: "destaque" },
  { id: "2", studentName: "Ana Paula Ferreira", className: "Jovens", quarter: "2026-Q1", reason: "Maior número de visitantes trazidos (6)", date: "30/03/2026", type: "missionario" },
  { id: "3", studentName: "João Santos Lima", className: "Homens", quarter: "2025-Q4", reason: "Dedicação exemplar e participação ativa", date: "28/12/2025", type: "destaque" },
  { id: "4", studentName: "Pedro Henrique Costa", className: "Adolescentes", quarter: "2025-Q4", reason: "Maior assiduidade entre os adolescentes", date: "28/12/2025", type: "destaque" },
];

export default function DestaquesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Destaques do Trimestre</h1>
          <p className="page-subtitle">Alunos destaque e missionários</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Novo Destaque
        </Button>
      </div>

      {/* Current Quarter Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-accent/30 bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center">
                <Star className="h-8 w-8 text-accent" />
              </div>
              <div>
                <p className="text-xs text-accent-dark font-medium uppercase tracking-wider">⭐ Aluno Destaque do Trimestre</p>
                <p className="text-xl font-bold text-gray-900 mt-1">Maria Silva Oliveira</p>
                <p className="text-sm text-gray-500">Classe: Mulheres</p>
                <p className="text-sm text-gray-600 mt-2 italic">&ldquo;100% de frequência e participação exemplar&rdquo;</p>
                <Badge variant="success" className="mt-2">1º Trimestre 2026</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-xs text-primary font-medium uppercase tracking-wider">🏆 Aluno Missionário do Trimestre</p>
                <p className="text-xl font-bold text-gray-900 mt-1">Ana Paula Ferreira</p>
                <p className="text-sm text-gray-500">Classe: Jovens</p>
                <p className="text-sm text-gray-600 mt-2 italic">&ldquo;Maior número de visitantes trazidos (6)&rdquo;</p>
                <Badge variant="default" className="mt-2">1º Trimestre 2026</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Highlights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-accent" />
            Histórico de Destaques
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {destaques.map(d => (
              <div key={d.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    d.type === "destaque" ? "bg-accent/20" : "bg-primary/10"
                  }`}>
                    {d.type === "destaque" ? (
                      <Star className="h-6 w-6 text-accent" />
                    ) : (
                      <Trophy className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{d.studentName}</p>
                    <p className="text-sm text-gray-500">{d.className} • {d.date}</p>
                    <p className="text-sm text-gray-600 italic mt-0.5">{d.reason}</p>
                  </div>
                </div>
                <Badge variant={d.type === "destaque" ? "warning" : "default"}>
                  {d.type === "destaque" ? "Destaque" : "Missionário"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Destaque</DialogTitle>
            <DialogDescription>Registre um aluno destaque ou missionário</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); setIsDialogOpen(false); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student">Aluno</Label>
              <Input id="student" name="student" required placeholder="Nome do aluno" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class">Classe</Label>
              <Input id="class" name="class" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <select name="type" className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                <option value="destaque">Aluno Destaque</option>
                <option value="missionario">Aluno Missionário</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo</Label>
              <Textarea id="reason" name="reason" required />
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
