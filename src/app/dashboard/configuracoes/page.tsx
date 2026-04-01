"use client";

import React, { useState } from "react";
import { Settings, Save, Church, Shield, Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function ConfiguracoesPage() {
  const [saved, setSaved] = useState(false);
  const [churchName, setChurchName] = useState("Igreja Assembleia de Deus");
  const [currentQuarter, setCurrentQuarter] = useState("2026-Q1");

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">Parâmetros gerais do sistema</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Dados da Igreja */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Church className="h-5 w-5 text-primary" />
              Dados da Igreja
            </CardTitle>
            <CardDescription>Informações básicas da congregação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="churchName">Nome da Igreja</Label>
              <Input
                id="churchName"
                value={churchName}
                onChange={e => setChurchName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo">Logo</Label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Church className="h-8 w-8 text-primary" />
                </div>
                <Button variant="outline" size="sm">Alterar Logo</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trimestre */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Trimestre Atual
            </CardTitle>
            <CardDescription>Defina o trimestre vigente da EBD</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Trimestre</Label>
              <Select value={currentQuarter} onValueChange={setCurrentQuarter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026-Q1">1º Trimestre 2026 (Jan-Mar)</SelectItem>
                  <SelectItem value="2026-Q2">2º Trimestre 2026 (Abr-Jun)</SelectItem>
                  <SelectItem value="2026-Q3">3º Trimestre 2026 (Jul-Set)</SelectItem>
                  <SelectItem value="2026-Q4">4º Trimestre 2026 (Out-Dez)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Permissões */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Perfis de Acesso
            </CardTitle>
            <CardDescription>Configuração de permissões por perfil</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { role: "Administrador", permissions: "Acesso total ao sistema", color: "bg-red-50 text-red-700 border-red-200" },
                { role: "Dirigente", permissions: "Visão geral, relatórios, todas as classes", color: "bg-blue-50 text-blue-700 border-blue-200" },
                { role: "Vice-Dirigente", permissions: "Apoio com permissões configuráveis", color: "bg-purple-50 text-purple-700 border-purple-200" },
                { role: "Professor", permissions: "Acesso apenas à sua classe", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                { role: "Apoio/Secretaria", permissions: "Cadastros e relatórios", color: "bg-amber-50 text-amber-700 border-amber-200" },
              ].map(p => (
                <div key={p.role} className={`p-4 rounded-lg border ${p.color}`}>
                  <p className="font-medium">{p.role}</p>
                  <p className="text-xs mt-0.5 opacity-80">{p.permissions}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} className="min-w-40">
            {saved ? (
              <><Check className="h-4 w-4" /> Configurações salvas!</>
            ) : (
              <><Save className="h-4 w-4" /> Salvar Configurações</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
