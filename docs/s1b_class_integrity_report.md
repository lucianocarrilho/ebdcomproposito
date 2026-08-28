# Relatório S1b: Saneamento e Integridade

Este relatório documenta a execução da etapa corretiva S1b, com ênfase na auditoria de dados residuais e na garantia matemática e sistêmica da integridade da coluna `Class.organizationId`.

## 1. Auditoria e Limpeza (Manifesto e Guardião)
A auditoria comprovou a existência de resíduos oriundos de falhas de timeout e erros assertivos prematuros antes da calibração final do banco de testes:
- **Resíduos Removidos:** 15 Organizations, 4 Leaders, 1 Class.
- **IDs Abreviados:** `cmtbdv...`, `cmtc6e...`, `cmtatg...`, `cmtca2...`, entre outros.
- **Origem Comprovada:**
  - As 15 Organizations e 4 Leaders são oriundos das rotinas de testes que sofreram crashes/timeouts abruptos ao longo da calibração do setup inicial (sendo 13 organizações das suítes isoladas e 2 criadas nos testes 14/15, além dos 4 líderes do `phase4a`).
  - A `Test Org Class` vazou pontualmente no teste 14 pois a falha inicial da assertiva (P2003) interrompeu a thread do teste antes que sua linha de deleção em escopo fosse chamada.
- **Cleanup Realizado:** Execução através de guardião obrigatório validando explicitamente a string `/u223033896_ebd_test`. Todos os IDs extraídos do manifesto foram cirurgicamente deletados via `$transaction` (`RESTRICT` respeitado com exclusões cascata locais invertidas: Leaders -> Class -> Orgs).
- **Inventário Pós-limpeza:** Organizations (0), Users (0), Memberships (0), Classes (0), Students (0), Leaders (0), CSAs (0).
- _dev e produção **100% intocados**.

## 2. Infraestrutura Autossuficiente de Cleanup
Para evitar novos vazamentos como a da `Test Org Class`, o framework do `s1_schema.test.ts` recebeu um hook `afterEach` inteligente:
- Durante cada teste `it(...)`, IDs criados via inserções dinâmicas são imediatamente cacheados em um state tracker (`fixturesToCleanup`).
- Caso o teste quebre ou lance um crash no expect local, a promessa do `afterEach` varre os IDs e deleta tudo rigorosamente usando um fallback via `deleteMany({ id: { in: [...] } })`.
- Garantia de que NENHUM teste deixará lixo entre rodadas, não dependendo de código síncrono localizado no final de blocos arriscados.

## 3. Correção de Schema (Integridade Forte e Assertivas)
- `Class.organizationId` barrada contra deleções acidentais via `onDelete: Restrict`.
- **Códigos Rejeitados nos Testes:**
  - `P2002`: Unique Constraint garantido na prevenção de CSAs duplicadas.
  - `P2003`: Foreign Key Enforcement aplicado nas invasões multi-tenant, inserções falsas e deleções bloqueadas pelo `RESTRICT`.
  - `P2010` (MySQL 1048): O erro cru subjacente acionado quando é injetada sintaxe bruta de QueryRaw com `organizationId = NULL`.

## 4. Correção Idempotente do Seed
O arquivo `prisma/seed.ts` foi refatorado. A inserção imperativa com sufixos dinâmicos baseados no Date foi erradicada em prol de um método **Upsert Idempotente**.
- Slug garantido de forma fixa (`"sede-principal"`), evitando criação de novas instâncias e sujeira no ambiente.
- ID da Organização capturado via cache/criação imediata e espelhado explicitamente em todas as inserções subsequentes da entidade genérica `Class`. Nenhuma URL, ID ou banco "chumbado" foi utilizado.

## 5. Regressão Final e Testes Duplos
Execuções da suíte regressiva (`npm run test` x2 consecutivas via Windows Shell Script):
- Test Files: 3 passed
- Tests: **43 passed (43/43)** (As 2 iterações resultaram em passe perfeito).
- O encerramento sistêmico final resultou no **Cleanup completo**. O status contínuo das tabelas após testes cruzados atestam sua impecabilidade (Orgs: 0, Classes: 0, Users: 0, etc.).

As migrações nativas do repositório (0_init e a migração S1) estão imaculadas sem nenhum tipo de alteração intrusiva. A base para a etapa final está matematicamente selada.
