"use client";

import React, { useState, useEffect } from "react";
import { Send, MessageSquare, AlertTriangle, CheckCircle2, Info, Loader2, Trash2, Eye, RefreshCw } from "lucide-react";
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
      setLoadingHistory(true);
      // Adding a timestamp to prevent browser cache
      const res = await fetch(`/api/notifications/sent?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setSentAvisos(data);
      } else {
        console.error("Erro ao buscar histórico");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // Auto refresh every 30s to keep sync
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
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
        // Wait a bit before fetching to let DB settle if needed
        setTimeout(fetchHistory, 800);
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
    <div className="max-w-6xl mx-auto space-y-12 animate-fade-in pb-20">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3 text-3xl font-black">
          <MessageSquare className="h-8 w-8 text-primary" />
          Central de Comunicados
        </h1>
        <p className="page-subtitle text-lg text-gray-500">Gerencie e envie mensagens instantâneas para a escola</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Formulário de Envio */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-none shadow-premium overflow-hidden border-t-4 border-primary">
            <CardHeader className="bg-primary text-white text-center py-12">
              <CardTitle className="text-white text-3xl font-black mb-2">Novo Comunicado</CardTitle>
              <CardDescription className="text-white/90 text-sm font-medium">O aviso será disparado com som para toda a equipe logada.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleSend} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="font-bold text-gray-700 text-base">O que é o comunicado?</Label>
                  <Input 
                    id="title" 
                    placeholder="Título curto e direto..." 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="h-14 rounded-2xl text-lg border-gray-200 focus-visible:ring-primary shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-gray-700 text-base">Gravidade do Alerta</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-14 rounded-2xl text-base border-gray-200 shadow-sm focus:ring-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="info">
                        <div className="flex items-center gap-2">
                          <Info className="h-5 w-5 text-blue-500" /> Informativo Comum
                        </div>
                      </SelectItem>
                      <SelectItem value="warning">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-amber-500" /> Urgente / Mudança de Plano
                        </div>
                      </SelectItem>
                      <SelectItem value="success">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Comemoração / Positivo
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="font-bold text-gray-700 text-base">Instruções Detalhadas</Label>
                  <Textarea 
                    id="message" 
                    placeholder="Escreva aqui os detalhes..." 
                    rows={6}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="rounded-3xl resize-none p-5 text-base border-gray-200 focus-visible:ring-primary shadow-sm min-h-[180px]"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={sending} 
                  className="w-full h-16 text-xl font-black rounded-2xl shadow-2xl shadow-primary/30 bg-primary hover:bg-primary-dark hover:scale-[1.01] active:scale-95 transition-all"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin mr-3" /> Disparando...
                    </>
                  ) : (
                    <>
                      <Send className="h-6 w-6 mr-3" /> DISPARAR AGORA
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Histórico e Métricas */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-none shadow-premium h-full bg-white/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black flex items-center justify-between text-gray-400 uppercase tracking-widest">
                Histórico Recente
                <div className="flex items-center gap-3">
                  {loadingHistory && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 rounded-full" onClick={fetchHistory}>
                    <RefreshCw className="h-4 w-4 text-primary" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[750px] overflow-y-auto px-5 pb-8 space-y-4">
                {sentAvisos.length === 0 && !loadingHistory && (
                  <div className="py-24 text-center text-gray-400">
                    <MessageSquare className="h-12 w-12 mx-auto opacity-10 mb-3" />
                    <p className="text-sm font-medium">Nenhum aviso enviado por você recentemente</p>
                  </div>
                )}
                
                {sentAvisos.map((aviso) => (
                  <div key={aviso.id} className="p-5 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow group relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-black uppercase tracking-tighter px-2.5 py-1 rounded-lg ${
                        aviso.type === 'warning' ? 'bg-amber-100 text-amber-700' : 
                        aviso.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {aviso.type}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">
                        {new Date(aviso.createdAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <h4 className="font-black text-gray-900 text-base mb-1 leading-tight">{aviso.title}</h4>
                    <p className="text-xs text-gray-500 line-clamp-3 mb-4 leading-relaxed font-medium">{aviso.message}</p>
                    
                    <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-gray-100/80">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <Eye className="h-4 w-4" /> {aviso._count?.reads || 0} visualizações
                          </span>
                        </div>
                        <button 
                          onClick={() => handleDelete(aviso.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"
                          title="Excluir Permanentemente"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>

                      {aviso.reads && aviso.reads.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {aviso.reads.map((r: any, idx: number) => (
                            <span key={idx} className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-xl border border-emerald-100 flex items-center gap-1.5 group/name">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              {r.user.name.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <div className="pt-20 border-t border-gray-100/50">
        <div className="bg-gray-50/50 rounded-3xl p-8 text-center border border-gray-100/40">
           <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-2">Protocolo de Comunicação Escola-Coordenação</p>
           <p className="text-xs text-gray-400 font-medium max-w-2xl mx-auto">
             Todas as mensagens enviadas são assinadas e registradas para fins de auditoria. 
             O histórico é sincronizado em tempo real com os painéis dos professores.
           </p>
        </div>
      </div>
    </div>
  );
}
