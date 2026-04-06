"use client";

import React, { useState } from "react";
import { Send, MessageSquare, AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function AvisosPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) {
      toast.error("Preencha o título e a mensagem");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, type }),
      });

      if (res.ok) {
        toast.success("Aviso enviado com sucesso aos professores!");
        setTitle("");
        setMessage("");
      } else {
        toast.error("Erro ao enviar aviso");
      }
    } catch (error) {
      toast.error("Erro de conexão");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-primary" />
          Central de Comunicados
        </h1>
        <p className="page-subtitle">Envie mensagens e alertas sonoros para toda a coordenação e professores</p>
      </div>

      <Card className="border-none shadow-premium overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-primary/10">
          <CardTitle className="text-primary">Novo Comunicado</CardTitle>
          <CardDescription>Esta mensagem aparecerá instantaneamente no topo do painel dos destinatários.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSend} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="font-bold text-gray-700">Título do Aviso</Label>
              <Input 
                id="title" 
                placeholder="Ex: Reunião de Professores, Mudança de Sala..." 
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-bold text-gray-700">Tipo de Alerta</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-500" /> Informativo
                      </div>
                    </SelectItem>
                    <SelectItem value="warning">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" /> Urgente / Importante
                      </div>
                    </SelectItem>
                    <SelectItem value="success">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Parabéns / Sucesso
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end text-xs text-gray-500 pb-3 italic">
                O som de alerta será disparado de acordo com a urgência.
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message" className="font-bold text-gray-700">Mensagem Detalhada</Label>
              <Textarea 
                id="message" 
                placeholder="Descreva o comunicado aqui..." 
                rows={5}
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="rounded-2xl resize-none p-4"
              />
            </div>

            <Button 
              type="submit" 
              disabled={sending} 
              className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
            >
              {sending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Enviando...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" /> Disparar Comunicado
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl flex items-start gap-4">
        <Info className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
        <div className="space-y-1">
          <h4 className="font-bold text-blue-900">Como funciona o som?</h4>
          <p className="text-sm text-blue-700 leading-relaxed">
            Ao clicar em "Disparar", todos os usuários logados ouvirão um sinal sonoro em seus dispositivos. 
            Os aniversários também são monitorados automaticamente e avisados com uma semana de antecedência.
          </p>
        </div>
      </div>
    </div>
  );
}
