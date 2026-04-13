"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, Calendar, Users, UserPlus, 
  Check, X, MessageSquare, Download,
  Printer, Loader2, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface DailySummary {
  date: string;
  summary: {
    totalEnrolled: number;
    totalPresent: number;
    totalAbsent: number;
    totalJustified: number;
    totalVisitors: number;
    schoolFreq: number;
  };
  classes: {
    id: string;
    className: string;
    enrolled: number;
    present: number;
    absent: number;
    justified: number;
    visitors: number;
    freq: number;
  }[];
  leaders?: {
    enrolled: number;
    present: number;
    absent: number;
    justified: number;
    freq: number;
  };
}

export default function ResumoDiaPage() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [data, setData] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [date]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/daily?date=${date}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        toast.error("Erro ao buscar dados do dia");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  const exportPDF = () => {
    if (!data) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Título
    doc.setFontSize(20);
    doc.setTextColor(30, 58, 95);
    doc.text("Mapa Geral da EBD", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Data: ${new Date(date).toLocaleDateString('pt-BR')}`, pageWidth / 2, 28, { align: "center" });
    
    // Resumo Geral
    doc.setFontSize(14);
    doc.setTextColor(30, 58, 95);
    doc.text("Resumo Geral da Escola", 15, 40);
    
    autoTable(doc, {
      startY: 45,
      head: [['Total Matriculados', 'Presentes', 'Visitantes', 'Faltas', 'Freq %']],
      body: [[
        data.summary.totalEnrolled,
        data.summary.totalPresent,
        data.summary.totalVisitors,
        data.summary.totalAbsent,
        `${data.summary.schoolFreq}%`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 95] }
    });

    // Detalhe por Classe
    doc.text("Detalhamento por Classe", 15, (doc as any).lastAutoTable.finalY + 15);
    
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Classe', 'Matric.', 'Pres.', 'Visit.', 'Faltas', 'Freq %']],
      body: data.classes.map(c => [
        c.className,
        c.enrolled,
        c.present,
        c.visitors,
        c.absent,
        `${c.freq}%`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105] }
    });

    if (data.leaders) {
      doc.text("Liderança e Equipe", 15, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Equipe', 'Ativos', 'Pres.', 'Faltas', 'Justific.', 'Freq %']],
        body: [[
          'Liderança',
          data.leaders.enrolled,
          data.leaders.present,
          data.leaders.absent,
          data.leaders.justified,
          `${data.leaders.freq}%`
        ]],
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 95] }
      });
    }

    doc.save(`mapa-geral-ebd-${date}.pdf`);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header - Não sai na impressão */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Mapa Geral da EBD
          </h1>
          <p className="page-subtitle">Fechamento do dia e levantamento de estatísticas</p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="bg-white p-2 rounded-xl border flex items-center gap-2 shadow-sm flex-1 sm:flex-initial">
            <Calendar className="h-4 w-4 text-gray-400" />
            <Input 
              type="date" 
              className="border-none bg-transparent font-bold h-8 focus-visible:ring-0 w-full sm:w-36 text-sm" 
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" className="h-12 w-12 sm:h-10 sm:w-10 rounded-xl shadow-sm bg-white" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12 sm:h-10 sm:w-10 rounded-xl shadow-sm bg-white" onClick={exportPDF}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-500 font-medium">Gerando resumo estatístico...</p>
        </div>
      ) : data ? (
        <>
          {/* Cards de Resumo Geral */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-none shadow-premium bg-gradient-to-br from-blue-600 to-blue-700 text-white">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Presença Total</p>
                    <h3 className="text-4xl font-extrabold">{data.summary.totalPresent + data.summary.totalVisitors}</h3>
                    <p className="text-[10px] text-blue-100 mt-1">
                      {data.summary.totalPresent} Alunos + {data.summary.totalVisitors} Visitantes
                    </p>
                  </div>
                  <Users className="h-6 w-6 text-blue-200/50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-premium bg-white">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Matriculados</p>
                    <h3 className="text-4xl font-extrabold text-gray-900">{data.summary.totalEnrolled}</h3>
                    <p className="text-[10px] text-gray-400 mt-1">Total de alunos ativos</p>
                  </div>
                  <Badge variant="outline" className="text-blue-600 border-blue-100 bg-blue-50">100%</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-premium bg-white">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-emerald-500 text-xs font-bold uppercase tracking-wider mb-1">Frequência</p>
                    <h3 className="text-4xl font-extrabold text-emerald-600">{data.summary.schoolFreq}%</h3>
                    <p className="text-[10px] text-gray-400 mt-1">Média de frequência geral</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Check className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-premium bg-white">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-1">Visitantes</p>
                    <h3 className="text-4xl font-extrabold text-amber-600">{data.summary.totalVisitors}</h3>
                    <p className="text-[10px] text-gray-400 mt-1">Total de convidados hoje</p>
                  </div>
                  <UserPlus className="h-6 w-6 text-amber-200" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela Detalhada por Classe */}
          <Card className="border-none shadow-premium overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-4">
              <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ArrowRight className="h-5 w-5 text-primary" />
                Mapa de Classes - Resumo para Caderneta
              </CardTitle>
              <CardDescription>Dados individuais para preenchimento manual</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto scrollbar-hide">
                <Table className="min-w-[700px] sm:min-w-full">
                  <TableHeader>
                    <TableRow className="bg-gray-50/30">
                      <TableHead className="font-bold pl-6">Classe</TableHead>
                      <TableHead className="font-bold text-center">Matriculados</TableHead>
                      <TableHead className="font-bold text-center text-emerald-600 bg-emerald-50/30">P</TableHead>
                      <TableHead className="font-bold text-center text-red-600 bg-red-50/30">F</TableHead>
                      <TableHead className="font-bold text-center text-amber-600 bg-amber-50/30">J</TableHead>
                      <TableHead className="font-bold text-center text-primary bg-primary/5">Vis.</TableHead>
                      <TableHead className="font-bold text-center pr-6">Freq%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.classes.map(c => (
                      <TableRow key={c.id} className="hover:bg-gray-50/30 transition-colors">
                        <TableCell className="font-bold text-gray-900 pl-6 py-4">{c.className}</TableCell>
                        <TableCell className="text-center font-medium text-gray-500">{c.enrolled}</TableCell>
                        <TableCell className="text-center font-extrabold text-emerald-700 bg-emerald-50/10 underline decoration-emerald-200 underline-offset-4">{c.present}</TableCell>
                        <TableCell className="text-center font-extrabold text-red-700 bg-red-50/10 underline decoration-red-200 underline-offset-4">{c.absent}</TableCell>
                        <TableCell className="text-center font-extrabold text-amber-700 bg-amber-50/10 underline decoration-amber-200 underline-offset-4">{c.justified}</TableCell>
                        <TableCell className="text-center font-extrabold text-primary bg-primary/5 underline decoration-primary/20 underline-offset-4">{c.visitors}</TableCell>
                        <TableCell className="text-center font-bold text-gray-700 pr-6">
                          <Badge variant="secondary" className="font-extrabold">{c.freq}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Linha da Liderança */}
                    {data.leaders && (
                      <TableRow className="bg-indigo-50/50 hover:bg-indigo-50/80 transition-colors border-t-2 border-indigo-100">
                        <TableCell className="font-bold text-indigo-900 pl-6 py-4 flex items-center gap-2">
                          <Users className="h-4 w-4 text-indigo-500" />
                          Liderança (Equipe)
                        </TableCell>
                        <TableCell className="text-center font-medium text-indigo-700">{data.leaders.enrolled}</TableCell>
                        <TableCell className="text-center font-extrabold text-emerald-700">{data.leaders.present}</TableCell>
                        <TableCell className="text-center font-extrabold text-red-700">{data.leaders.absent}</TableCell>
                        <TableCell className="text-center font-extrabold text-amber-700">{data.leaders.justified}</TableCell>
                        <TableCell className="text-center text-gray-400">-</TableCell>
                        <TableCell className="text-center font-bold text-indigo-700 pr-6">
                          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 font-extrabold">
                            {data.leaders.freq}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Linha de Totais da Tabela */}
                    <TableRow className="bg-gray-900 text-white font-bold hover:bg-gray-900">
                      <TableCell className="pl-6 py-4">TOTAIS GERAIS</TableCell>
                      <TableCell className="text-center">{data.summary.totalEnrolled}</TableCell>
                      <TableCell className="text-center text-emerald-400">{data.summary.totalPresent}</TableCell>
                      <TableCell className="text-center text-red-400">{data.summary.totalAbsent}</TableCell>
                      <TableCell className="text-center text-amber-400">{data.summary.totalJustified}</TableCell>
                      <TableCell className="text-center text-blue-300">{data.summary.totalVisitors}</TableCell>
                      <TableCell className="text-center pr-6">{data.summary.schoolFreq}%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          
          {/* Instruções para o Notebook */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4 animate-slide-up">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-blue-900">Dica para o Prontuário</h4>
              <p className="text-sm text-blue-700">
                A coluna <strong>P</strong> representa as presenças confirmadas. 
                A coluna <strong>F</strong> são as faltas e <strong>J</strong> as justificativas.
                Os <strong>Visitantes</strong> da última coluna devem ser somados ao total de presenças para o relatório de encerramento da escola.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-500 italic">Nenhum dado encontrado para esta data.</p>
        </div>
      )}
    </div>
  );
}
