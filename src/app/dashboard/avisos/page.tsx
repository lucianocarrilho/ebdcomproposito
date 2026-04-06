"use client";

import React, { useState, useEffect } from "react";
import { Send, MessageSquare, AlertTriangle, CheckCircle2, Info, Loader2, Trash2, Eye } from "lucide-react";
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
  const [sentAvisos, setSentAvisos] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/notifications/sent");
      if (res.ok) {
        const data = await res.json();
        setSentAvisos(data);
      }
    } catch (error) {
      console.error("Erro ao carregar histórico");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

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
        toast.success("Aviso enviado com sucesso!");
        setTitle("");
        setMessage("");
        fetchHistory(); // Refresh history
      } else {
        toast.error("Erro ao enviar aviso");
      }
    } catch (error) {
      toast.error("Erro de conexão");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este aviso? Ele sumirá do painel de todos os professores.")) return;

    try {
      const res = await fetch(`/api/notifications/sent?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Aviso excluído");
        setSentAvisos(prev => prev.filter(a => a.id !== id));
      }
    } catch (error) {
      toast.error("Erro ao excluir");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-fade-in pb-20">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-primary" />
          Central de Comunicados
        </h1>
        <p className="page-subtitle text-lg">Gerencie e envie mensagens instantâneas para a escola</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Formulário de Envio */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-none shadow-premium overflow-hidden">
            <CardHeader className="bg-primary text-white">
              <CardTitle>Novo Comunicado</CardTitle>
              <CardDescription className="text-white/70">O aviso será disparado com som para todos os alvos.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSend} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="font-bold text-gray-700">O que é o comunicado?</Label>
                  <Input 
                    id="title" 
                    placeholder="Título curto e direto..." 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="h-12 rounded-xl focus-visible:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-gray-700">Gravidade do Alerta</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-500" /> Informativo Comum
                        </div>
                      </SelectItem>
                      <SelectItem value="warning">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" /> Urgente / Mudança de Plano
                        </div>
                      </SelectItem>
                      <SelectItem value="success">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Comemoração / Positivo
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="font-bold text-gray-700">Instruções Detalhadas</Label>
                  <Textarea 
                    id="message" 
                    placeholder="Escreva aqui os detalhes..." 
                    rows={6}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="rounded-2xl resize-none p-4 focus-visible:ring-primary"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={sending} 
                  className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary-light transition-all"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Disparando...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" /> Enviar Agora
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Histórico e Métricas */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-premium h-full">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                Histórico Recente
                {loadingHistory && <Loader2 className="h-4 w-4 animate-spin" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto px-4 pb-4 space-y-3">
                {sentAvisos.length === 0 && !loadingHistory && (
                  <div className="py-12 text-center text-gray-400">
                    <MessageSquare className="h-10 w-10 mx-auto opacity-20 mb-2" />
                    <p className="text-sm">Nenhum aviso enviado por você</p>
                  </div>
                )}
                
                {sentAvisos.map((aviso) => (
                  <div key={aviso.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 group relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        aviso.type === 'warning' ? 'bg-amber-100 text-amber-700' : 
                        aviso.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {aviso.type}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(aviso.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="font-bold text-gray-900 text-sm mb-1">{aviso.title}</h4>
                    <p className="text-xs text-gray-600 line-clamp-2 mb-3">{aviso.message}</p>
                    
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-200/60">
                      <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {aviso._count?.reads || 0} leituras
                        </span>
                      </div>
                      <button 
                        onClick={() => handleDelete(aviso.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
