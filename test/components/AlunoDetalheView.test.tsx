import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { AlunoDetalheView } from "../../src/app/dashboard/alunos/[id]/page";

describe("AlunoDetalheView - Tratamento de Erros e 404", () => {
  it("deve renderizar tela genérica de 'Aluno não encontrado' e não acessar student.stats ao receber errorStatus 404", () => {
    // Rendendo o componente puramente com estado de 404 e student nulo
    const html = renderToString(
      <AlunoDetalheView
        student={null}
        loading={false}
        errorStatus={404}
        canMutate={true}
      />
    );

    expect(html).toContain("Aluno não encontrado");
    expect(html).toContain("Voltar para Alunos");
    expect(html).not.toContain("stats");
  });

  it("deve renderizar os dados do aluno corretamente quando a resposta é 200 (student preenchido)", () => {
    const mockStudent: any = {
      id: "mock_1",
      name: "João Silva",
      gender: "MASCULINO",
      birthDate: "2010-01-01",
      phone: "1199999999",
      address: "Rua A",
      guardian: "Maria",
      active: true,
      baptized: true,
      member: true,
      newConvert: false,
      observations: "",
      createdAt: new Date().toISOString(),
      class: { name: "Classe Jovem" },
      stats: {
        totalAulas: 10,
        presencas: 8,
        faltas: 2,
        justificadas: 0,
        frequencia: 80,
        visitantesTrazidos: 1,
        destaques: 0,
      },
      attendanceItems: [],
      visitorsInvited: [],
    };

    const html = renderToString(
      <AlunoDetalheView
        student={mockStudent}
        loading={false}
        errorStatus={null}
        canMutate={true}
      />
    );

    expect(html).toContain("João Silva");
    expect(html).toContain("Classe Jovem");
    expect(html).toContain("80");
  });

  it("não deve exibir nenhum dado de outra organização no 404 (student null)", () => {
    const html = renderToString(
      <AlunoDetalheView
        student={null}
        loading={false}
        errorStatus={404}
        canMutate={false}
      />
    );

    expect(html).not.toContain("João Silva");
    expect(html).not.toContain("Classe Jovem");
  });
});
