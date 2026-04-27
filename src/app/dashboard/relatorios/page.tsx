"use client";

import React, { useState, useEffect } from "react";
import { BarChart3, Download, FileText, Users, GraduationCap, UserPlus, Cake, Award, Filter, Loader2, Crown, BookOpen, BookMarked, DollarSign, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const reportTypes = [
  { id: "aluno", label: "Por Aluno", icon: Users, description: "Frequência individual de cada aluno" },
  { id: "classe", label: "Por Classe", icon: GraduationCap, description: "Dados consolidados por classe" },
  { id: "lideranca", label: "Liderança", icon: Crown, description: "Frequência da equipe de liderança" },
  { id: "trimestre", label: "Por Trimestre", icon: BarChart3, description: "Resumo trimestral completo" },
  { id: "visitantes", label: "Visitantes", icon: UserPlus, description: "Relatório de visitantes e convidados" },
  { id: "aniversariantes", label: "Aniversariantes", icon: Cake, description: "Aniversariantes do período" },
  { id: "premiados", label: "Premiados", icon: Award, description: "Alunos destaque e missionários" },
];

export default function RelatoriosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.role === "PROFESSOR") {
      toast.error("O acesso aos relatórios gerenciais é restrito à Secretaria e Direção");
      router.push("/dashboard");
    }
  }, [status, session, router]);

  const [selectedReport, setSelectedReport] = useState("classe");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [selectedClass, setSelectedClass] = useState("Todas");
  const [classes, setClasses] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await fetch("/api/classes");
        const json = await res.json();
        setClasses(json);
      } catch (err) {
        toast.error("Erro ao carregar classes");
      }
    };
    fetchClasses();
  }, []);

  // Fetch report data on filter change
  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          startDate: dateFrom,
          endDate: dateTo,
          classId: selectedClass,
          type: selectedReport
        });
        const res = await fetch(`/api/reports?${params.toString()}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        toast.error("Erro ao carregar relatório");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [dateFrom, dateTo, selectedClass, selectedReport]);

  const handleExportPDF = async () => {
    if (!data) {
      toast.error("Aguarde o carregamento dos dados");
      return;
    }

    try {
      const doc = new jsPDF();
      const reportTitle = reportTypes.find(r => r.id === selectedReport)?.label || "Relatório EBD";
      
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Função para carregar imagem como Base64
      const getBase64Image = (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = reject;
          img.src = url;
        });
      };

      try {
        // Carregar logos
        const logoEbd = await getBase64Image('/logo_ebd.png');
        const logoIeadpe = await getBase64Image('/logo_ieadpe.png');

        // Logo EBD (Esquerda)
        doc.addImage(logoEbd, 'PNG', 15, 10, 25, 18);
        
        // Logo IEADPE (Direita)
        doc.addImage(logoIeadpe, 'PNG', pageWidth - 40, 10, 25, 23);
      } catch (err) {
        console.warn("Logos não carregadas, continuando sem elas.");
      }

      // Cabeçalho Centralizado
      doc.setFontSize(22);
      doc.setTextColor(30, 58, 95);
      doc.setFont("helvetica", "bold");
      const titleText = "EBD com Propósito";
      const titleWidth = doc.getTextWidth(titleText);
      doc.text(titleText, (pageWidth - titleWidth) / 2, 22);
      
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");
      
      const typeText = reportTitle;
      const typeWidth = doc.getTextWidth(typeText);
      doc.text(typeText, (pageWidth - typeWidth) / 2, 30);
      
      // Formatar datas sem conversão UTC (evita erro de fuso horário)
      const formatDateBR = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
      };
      const periodText = `Período: ${formatDateBR(dateFrom)} a ${formatDateBR(dateTo)}`;
      const periodWidth = doc.getTextWidth(periodText);
      doc.text(periodText, (pageWidth - periodWidth) / 2, 36);

      // Linha Divisora
      doc.setDrawColor(230, 230, 230);
      doc.line(15, 42, pageWidth - 15, 42);

      // Lógica por tipo de relatório (Tabelas)
      if (selectedReport === "classe" && data.classData) {
        autoTable(doc, {
          startY: 50,
          head: [['Classe', 'Alunos', 'Presenças', 'Faltas', 'Justif.', 'Bíblias', 'Revistas', 'Ofertas', 'Outros', 'Frequência %']],
          body: data.classData.map((c: any) => [
            c.classe,
            c.matriculados,
            c.matriculados - c.faltas - c.justificadas,
            c.faltas,
            c.justificadas,
            c.biblias,
            c.revistas,
            `R$ ${c.ofertas.toFixed(2)}`,
            c.outros,
            `${c.mediaFreq}%`
          ]),
          theme: 'striped',
          headStyles: { fillColor: [30, 58, 95] },
          styles: { fontSize: 8 }
        });
      } else if (selectedReport === "aluno" && data.students) {
        autoTable(doc, {
          startY: 50,
          head: [['Aluno', 'Classe', 'Presenças', 'Faltas', 'Freq %']],
          body: data.students.map((s: any) => [
            s.name,
            s.classe,
            s.presencas,
            s.faltas,
            `${s.freq}%`
          ]),
          theme: 'striped',
          headStyles: { fillColor: [30, 58, 95] },
          styles: { fontSize: 9 }
        });
      } else if (selectedReport === "aniversariantes" && data.aniversariantes) {
        autoTable(doc, {
          startY: 50,
          head: [['Aniversariante', 'Data', 'Classe']],
          body: data.aniversariantes.map((a: any) => [
            a.name,
            new Date(a.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }),
            a.classe
          ]),
          theme: 'striped',
          headStyles: { fillColor: [30, 58, 95] },
          styles: { fontSize: 9 }
        });
      } else if (selectedReport === "visitantes" && data.visitantes) {
        autoTable(doc, {
          startY: 50,
          head: [['Visitante', 'Data', 'Classe', 'Convidado Por', 'Observações']],
          body: data.visitantes.map((v: any) => [
            v.name,
            new Date(v.date).toLocaleDateString('pt-BR'),
            v.classe,
            v.convidadoPor,
            v.observations || '-'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [30, 58, 95] },
          styles: { fontSize: 9 }
        });
      } else if (selectedReport === "lideranca" && data.leaders) {
        autoTable(doc, {
          startY: 50,
          head: [['Líder', 'Cargo', 'Classe', 'Presenças', 'Faltas', 'Justif.', 'Freq %']],
          body: data.leaders.map((l: any) => [
            l.name,
            l.role,
            l.classe,
            l.presencas,
            l.faltas,
            l.justificadas,
            `${l.freq}%`
          ]),
          theme: 'striped',
          headStyles: { fillColor: [30, 58, 95] },
          styles: { fontSize: 9 }
        });
      }

      // Rodapé
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(170);
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Gerado em: ${new Date().toLocaleString()} - Sistema EBD com Propósito`, 15, 287);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 30, 287);
      }

      doc.save(`relatorio-ebd-${selectedReport}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    }
  };

  const renderReportContent = () => {
    if (loading) {
      return (
        <div className="h-64 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-dashed border-gray-200">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Processando estatísticas...</p>
        </div>
      );
    }

    if (!data) return null;

    if (selectedReport === "classe") {
      return (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="overflow-hidden border-none shadow-premium">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Frequência por Classe (%)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.classData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="classe" tick={{ fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="mediaFreq" fill="#1e3a5f" radius={[6, 6, 0, 0]} name="Frequência %" barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-none shadow-premium">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  Resumo Detalhado por Classe
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {data.classData?.map((c: any) => (
                    <div key={c.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100 transition-hover">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-bold text-gray-900">{c.classe}</p>
                        <Badge className={`${c.mediaFreq >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                          {c.mediaFreq}% freq.
                        </Badge>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center">
                        <div className="space-y-1">
                          <p className="text-lg font-bold text-gray-900">{c.matriculados}</p>
                          <p className="text-[10px] uppercase tracking-tight text-gray-500 font-medium">Alunos</p>
                        </div>
                        <div className="space-y-1 border-l border-gray-200">
                          <p className="text-lg font-bold text-emerald-600">{c.matriculados}</p>
                          <p className="text-[10px] uppercase tracking-tight text-gray-500 font-medium">Ativos</p>
                        </div>
                        <div className="space-y-1 border-l border-gray-200">
                          <p className="text-lg font-bold text-red-600">{c.faltas}</p>
                          <p className="text-[10px] uppercase tracking-tight text-gray-500 font-medium">Faltas</p>
                        </div>
                        <div className="space-y-1 border-l border-gray-200">
                          <p className="text-lg font-bold text-amber-600">{c.justificadas}</p>
                          <p className="text-[10px] uppercase tracking-tight text-gray-500 font-medium">Justif.</p>
                        </div>
                        <div className="space-y-1 border-l border-gray-200 hidden sm:block">
                          <p className="text-lg font-bold text-blue-600">{c.biblias}</p>
                          <p className="text-[10px] uppercase tracking-tight text-gray-500 font-medium">Bíblias</p>
                        </div>
                        <div className="space-y-1 border-l border-gray-200 hidden sm:block">
                          <p className="text-lg font-bold text-purple-600">{c.revistas}</p>
                          <p className="text-[10px] uppercase tracking-tight text-gray-500 font-medium">Revistas</p>
                        </div>
                        <div className="space-y-1 border-l border-gray-200 hidden sm:block">
                          <p className="text-lg font-bold text-green-600">R$ {c.ofertas.toFixed(2)}</p>
                          <p className="text-[10px] uppercase tracking-tight text-gray-500 font-medium">Ofertas</p>
                        </div>
                        <div className="space-y-1 border-l border-gray-200 hidden sm:block">
                          <p className="text-lg font-bold text-orange-600">{c.outros}</p>
                          <p className="text-[10px] uppercase tracking-tight text-gray-500 font-medium">Outros</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-premium text-center">
              <Users className="h-5 w-5 text-gray-400 mx-auto mb-2" />
              <p className="text-3xl font-extrabold text-gray-900">{data.summary?.totalStudents}</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de Alunos</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-premium text-center">
              <BarChart3 className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
              <p className="text-3xl font-extrabold text-emerald-600">{data.summary?.generalFreq}%</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Frequência Geral</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-premium text-center">
              <Filter className="h-5 w-5 text-red-500 mx-auto mb-2" />
              <p className="text-3xl font-extrabold text-red-600">{data.summary?.totalFaltas}</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de Faltas</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-premium text-center">
              <FileText className="h-5 w-5 text-amber-500 mx-auto mb-2" />
              <p className="text-3xl font-extrabold text-amber-600">{data.summary?.totalJustificadas}</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Justificadas</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-premium text-center">
              <BookOpen className="h-5 w-5 text-blue-500 mx-auto mb-2" />
              <p className="text-3xl font-extrabold text-blue-600">{data.summary?.totalBiblias}</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de Bíblias</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-premium text-center">
              <BookMarked className="h-5 w-5 text-purple-500 mx-auto mb-2" />
              <p className="text-3xl font-extrabold text-purple-600">{data.summary?.totalRevistas}</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de Revistas</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-premium text-center">
              <DollarSign className="h-5 w-5 text-green-500 mx-auto mb-2" />
              <p className="text-3xl font-extrabold text-green-600">R$ {data.summary?.totalOfertas.toFixed(2)}</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de Ofertas</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-premium text-center">
              <Hash className="h-5 w-5 text-orange-500 mx-auto mb-2" />
              <p className="text-3xl font-extrabold text-orange-600">{data.summary?.totalOutros}</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de Outros</p>
            </div>
          </div>
        </>
      );
    }

    if (selectedReport === "aluno") {
      return (
        <Card className="border-none shadow-premium">
          <CardHeader>
            <CardTitle>Frequência Individual Por Aluno</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                    <th className="pb-3 px-2">Aluno</th>
                    <th className="pb-3 px-2">Classe</th>
                    <th className="pb-3 px-2 text-center">Freq. %</th>
                    <th className="pb-3 px-2 text-center">Presenças</th>
                    <th className="pb-3 px-2 text-center">Faltas</th>
                    <th className="pb-3 px-2 text-center">Justif.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.students?.map((s: any) => (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-2 font-medium text-gray-900">{s.name}</td>
                      <td className="py-3 px-2 text-gray-600">{s.classe}</td>
                      <td className="py-3 px-2 text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${s.freq >= 75 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          {s.freq}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center font-medium text-emerald-600">{s.presencas}</td>
                      <td className="py-3 px-2 text-center font-medium text-red-600">{s.faltas}</td>
                      <td className="py-3 px-2 text-center font-medium text-amber-600">{s.justificadas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (selectedReport === "aniversariantes") {
      return (
        <Card className="border-none shadow-premium">
          <CardHeader>
            <CardTitle>Aniversariantes do Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.aniversariantes?.length > 0 ? (
                data.aniversariantes.map((s: any) => (
                  <div key={s.id} className="p-4 rounded-2xl bg-white border border-gray-100 flex items-center gap-4 hover:shadow-lg transition-all animate-scale-in">
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {s.photo ? <img src={s.photo} className="h-full w-full object-cover" alt={s.name} /> : <Users className="h-6 w-6 text-primary/40" />}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 line-clamp-1">{s.name}</p>
                      <p className="text-xs text-gray-500 mb-1">{s.classe}</p>
                      <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 font-extrabold">
                        {new Date(s.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-10 text-center text-gray-500">
                  <Cake className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhum aniversariante encontrado neste período.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (selectedReport === "visitantes") {
      return (
        <Card className="border-none shadow-premium">
          <CardHeader>
            <CardTitle>Visitantes no Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                    <th className="pb-3 px-2">Visitante</th>
                    <th className="pb-3 px-2">Data</th>
                    <th className="pb-3 px-2">Classe</th>
                    <th className="pb-3 px-2">Convidado Por</th>
                    <th className="pb-3 px-2">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.visitantes && data.visitantes.length > 0 ? (
                    data.visitantes.map((v: any) => (
                      <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-2 font-medium text-gray-900">{v.name}</td>
                        <td className="py-3 px-2 text-gray-600">{new Date(v.date).toLocaleDateString('pt-BR')}</td>
                        <td className="py-3 px-2 text-gray-600">
                          <Badge variant="outline" className="font-normal">{v.classe}</Badge>
                        </td>
                        <td className="py-3 px-2 text-gray-600">{v.convidadoPor}</td>
                        <td className="py-3 px-2 text-gray-500 italic max-w-xs truncate" title={v.observations || ""}>
                          {v.observations || '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-500 font-medium bg-gray-50/30 rounded-lg">
                        <UserPlus className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                        Nenhum visitante registrado neste período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (selectedReport === "lideranca") {
      return (
        <>
          <Card className="border-none shadow-premium">
            <CardHeader className="bg-amber-50/30 border-b border-amber-100">
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                Frequência Individual da Liderança
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                      <th className="pb-3 px-2">Líder</th>
                      <th className="pb-3 px-2">Cargo</th>
                      <th className="pb-3 px-2">Classe</th>
                      <th className="pb-3 px-2 text-center">Freq. %</th>
                      <th className="pb-3 px-2 text-center">Presenças</th>
                      <th className="pb-3 px-2 text-center">Faltas</th>
                      <th className="pb-3 px-2 text-center">Justif.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.leaders?.map((l: any) => (
                      <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm">
                              {l.photo ? <img src={l.photo} className="h-full w-full object-cover" alt={l.name} /> : <span className="text-xs font-bold text-primary">{l.name?.[0]}</span>}
                            </div>
                            <span className="font-medium text-gray-900">{l.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-50 font-bold text-[10px] uppercase">{l.role}</Badge>
                        </td>
                        <td className="py-3 px-2 text-gray-600">{l.classe}</td>
                        <td className="py-3 px-2 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${l.freq >= 75 ? 'bg-emerald-50 text-emerald-600' : l.freq >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                            {l.freq}%
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center font-medium text-emerald-600">{l.presencas}</td>
                        <td className="py-3 px-2 text-center font-medium text-red-600">{l.faltas}</td>
                        <td className="py-3 px-2 text-center font-medium text-amber-600">{l.justificadas}</td>
                      </tr>
                    ))}
                    {(!data.leaders || data.leaders.length === 0) && (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-gray-500 font-medium bg-gray-50/30 rounded-lg">
                          <Crown className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          Nenhum registro de presença da liderança encontrado neste período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          {data.summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-premium text-center">
                <Crown className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                <p className="text-3xl font-extrabold text-gray-900">{data.summary.totalLeaders}</p>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de Líderes</p>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-premium text-center">
                <BarChart3 className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
                <p className="text-3xl font-extrabold text-emerald-600">{data.summary.generalFreq}%</p>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Frequência Geral</p>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-premium text-center">
                <Filter className="h-5 w-5 text-red-500 mx-auto mb-2" />
                <p className="text-3xl font-extrabold text-red-600">{data.summary.totalFaltas}</p>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total de Faltas</p>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-premium text-center">
                <FileText className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                <p className="text-3xl font-extrabold text-amber-600">{data.summary.totalJustificadas}</p>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Justificadas</p>
              </div>
            </div>
          )}
        </>
      );
    }

    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-gray-100 shadow-premium">
        <GraduationCap className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900">Em desenvolvimento</h3>
        <p className="text-gray-500 mt-2">Esta seção de relatórios será implementada em breve.</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="page-header">
        <h1 className="page-title">Relatórios</h1>
        <p className="page-subtitle">Dados e estatísticas da EBD em tempo real</p>
      </div>

      {/* Report Type Selection */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {reportTypes.map(r => (
          <button
            key={r.id}
            onClick={() => setSelectedReport(r.id)}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              selectedReport === r.id
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <r.icon className={`h-5 w-5 mb-2 ${selectedReport === r.id ? "text-primary" : "text-gray-400"}`} />
            <p className={`text-sm font-medium ${selectedReport === r.id ? "text-primary" : "text-gray-700"}`}>{r.label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 hidden sm:block">{r.description}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end w-full">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">Data Início</Label>
              <Input 
                type="date" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)} 
                className="h-12 sm:h-10 rounded-xl sm:rounded-md shadow-sm"
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">Data Fim</Label>
              <Input 
                type="date" 
                value={dateTo} 
                onChange={e => setDateTo(e.target.value)} 
                className="h-12 sm:h-10 rounded-xl sm:rounded-md shadow-sm"
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">Classe</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-full h-12 sm:h-10 rounded-xl sm:rounded-md shadow-sm">
                  <SelectValue placeholder="Selecione uma Classe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todas">Todas as Classes</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 sm:w-auto h-12 sm:h-10 rounded-xl sm:rounded-md hover:bg-primary/5 hover:text-primary transition-all font-bold sm:font-normal"
                onClick={handleExportPDF}
              >
                <FileText className="h-4 w-4 mr-2" /> PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 sm:w-auto h-12 sm:h-10 rounded-xl sm:rounded-md hover:bg-emerald-50 hover:text-emerald-600 transition-all font-bold sm:font-normal"
              >
                <Download className="h-4 w-4 mr-2" /> Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {renderReportContent()}
    </div>
  );
}
