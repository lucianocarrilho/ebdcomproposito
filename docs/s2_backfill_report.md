# Relatório Técnico de Segurança e Auditoria — Fase S2 (Backfill User.classId -> ClassStaffAssignment)

## 1. Escopo e Propósito
A ferramenta `scripts/s2_backfill.ts` foi projetada para migrar com segurança cirúrgica as atribuições legadas de classe (`User.classId`) para a tabela relacional multi-tenant `ClassStaffAssignment` (`CSA`), garantindo a preservação absoluta dos dados existentes, eliminação de condições de corrida, proteção estrita de caminhos de arquivos e rastreabilidade via recibo de aplicação.

---

## 2. Guardião de Conexão e Allowlists (Execução Pré-PrismaClient)
A validação de ambiente ocorre **antes** da instanciação e conexão do `PrismaClient`. Se qualquer condição for violada, a conexão com o banco nem chega a ser iniciada.

### Regras do Guardião:
- **Host Autorizado (Allowlist estrita):** Apenas `srv890.hstgr.io`. Qualquer outro host é rejeitado imediatamente.
- **Bancos Autorizados para Leitura / Dry-Run:**
  - `u223033896_ebd_test`
  - `u223033896_ebd_dev`
- **Banco Autorizado para Modificações (`--apply` e `--rollback`):**
  - Somente `u223033896_ebd_test`. Modificações no `_dev` são estritamente proibidas nesta fase.
- **Denylist Absoluta de Produção:**
  - `u223033896_ebd2026`. Bloqueado terminantemente com exceção explícita.

---

## 3. Proteção Estrita de Caminhos (Manifestos e Recibos)
A ferramenta valida o caminho resolvido via `path.resolve` para impedir que manifestos ou recibos sejam salvos dentro da árvore do repositório:
- **Resolução e Checagem:** Compara o caminho com `process.cwd()`. Se o destino estiver dentro do repositório, a execução é abortada.
- **Preexistência de Recibo:** Recibos preexistentes **não** são sobrescritos (`fs.existsSync(path)` gera exceção).
- **Recibo em Dry-Run:** Modo `dry-run` grava o manifesto no diretório temporário do sistema (`os.tmpdir()`) por padrão ou em caminho externo explícito informado por CLI.

---

## 4. Validação do Snapshot e Eliminação de Condições de Corrida
Toda a re-validação do snapshot e a tomada de decisão (criar, idempotente ou conflito) ocorrem **inteiramente dentro da transação `Serializable` do PrismaClient**:

```typescript
await prisma.$transaction(
  async (tx) => {
    for (const candidate of manifest.candidates) {
      // Re-validação atômica de User, Class, Organization e Membership dentro da transação
      const user = await tx.user.findUnique({ where: { id: candidate.userId } });
      if (!user || user.classId !== candidate.classId) {
        throw new Error(`User ${candidate.userId} mudou de estado durante a transação`);
      }

      const cls = await tx.class.findUnique({ where: { id: candidate.classId } });
      if (!cls || !cls.status || !cls.organizationId || cls.organizationId !== candidate.organizationId) {
        throw new Error(`Class ${candidate.classId} mudou de estado durante a transação`);
      }

      const org = await tx.organization.findUnique({ where: { id: candidate.organizationId } });
      if (!org || !org.active) {
        throw new Error(`Organization ${candidate.organizationId} mudou de estado durante a transação`);
      }

      const mem = await tx.organizationMembership.findUnique({
        where: { id: candidate.organizationMembershipId }
      });

      if (
        !mem ||
        mem.userId !== candidate.userId ||
        mem.organizationId !== candidate.organizationId ||
        mem.status !== 'ACTIVE'
      ) {
        throw new Error(`Membership ${candidate.organizationMembershipId} mudou de estado durante a transação`);
      }

      const expectedRole = mem.role === 'PROFESSOR' ? 'PROFESSOR' : mem.role === 'APOIO' ? 'AUXILIAR' : null;
      if (expectedRole !== candidate.assignmentRole) {
        throw new Error(`Membership ${mem.id} role mudou durante a transação`);
      }

      // Checagem de Assignment dentro da transação
      const existing = await tx.classStaffAssignment.findUnique({
        where: {
          classId_organizationMembershipId: {
            classId: candidate.classId,
            organizationMembershipId: candidate.organizationMembershipId
          }
        }
      });

      if (existing) {
        if (
          existing.id === candidate.plannedAssignmentId &&
          existing.organizationId === candidate.organizationId &&
          existing.assignmentRole === candidate.assignmentRole
        ) {
          alreadyAppliedAssignments.push({ ... });
        } else {
          throw new Error('ASSIGNMENT_CONFLICT: Conflito com Assignment existente divergente');
        }
      } else {
        const created = await tx.classStaffAssignment.create({ ... });
        createdAssignments.push({ ... });
      }
    }
  },
  {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  }
);
```

---

## 5. Contrato do Recibo de Aplicação (`ApplyReceipt`)
O `--apply` gera um recibo fora do repositório contendo:

```json
{
  "receiptVersion": "1.0",
  "runId": "<runId_do_manifesto>",
  "sourceManifestChecksum": "<sha256_do_manifesto>",
  "host": "srv890.hstgr.io",
  "dbName": "u223033896_ebd_test",
  "appliedAt": "2026-08-28T19:44:00.000Z",
  "createdAssignments": [
    {
      "id": "csa-uuid...",
      "classId": "class-id",
      "organizationId": "org-id",
      "organizationMembershipId": "mem-id",
      "assignmentRole": "PROFESSOR",
      "active": true,
      "createdAt": "2026-08-28T19:44:00.000Z",
      "updatedAt": "2026-08-28T19:44:00.000Z"
    }
  ],
  "alreadyAppliedAssignments": []
}
```

### Escrita Atômica, Journal de Pré-Compromisso e Modo de Recuperação
- **Journal de Pré-Compromisso (`.pending`):** Antes de qualquer escrita no banco de dados, o script gera previamente os IDs e timestamps dos assignments e grava um journal `status: "PENDING"` no arquivo `${reciboPath}.pending` via `.tmp` e `renameSync`.
- **Validação Pré-Transação:** A transação `Serializable` só é iniciada após o arquivo `.pending` estar gravado e confirmado no sistema de arquivos externo.
- **Promoção Pós-Commit:** Após o `COMMIT` bem-sucedido no banco, o script promove o `.pending` para o recibo definitivo (`.json`) e remove o `.pending`.
- **Tratamento de Falha Pós-Commit e Recuperação:**
  - Se a gravação do recibo definitivo falhar pós-commit, o arquivo `.pending` é **estritamente PRESERVADO** e o script encerra com `RECOVERY_REQUIRED`.
  - O comando `--rollback` rejeita arquivos `.pending` para evitar ambiguidades.
  - O modo de recuperação `--recover-pending=<caminho> --checksum=<hash>` consulta o banco:
    - **Todos os registros existem com fingerprint idêntico:** Promove o `.pending` para o recibo definitivo sem alterar o banco.
    - **Zero registros existem:** Confirma que a transação não foi aplicada e remove o `.pending`.
    - **Existência parcial ou qualquer divergência:** Retorna `PENDING_CONFLICT` e faz zero alterações.

---

## 6. Rollback Baseado Exclusivamente no Recibo e Fingerprint Completo
O `--rollback` valida o checksum SHA-256 do recibo e confirma atômica e transacionalmente o fingerprint completo de cada registro listado em `createdAssignments` antes de permitir qualquer remoção:
- **Campos Comparados:** `id`, `classId`, `organizationId`, `organizationMembershipId`, `assignmentRole`, `active`, `createdAt` (ISO UTC) e `updatedAt` (ISO UTC).
- **Validação Rígida de Fingerprint:** Recibos legados ou incompletos (sem `active`, `createdAt` ou `updatedAt`) são imediatamente rejeitados com `RECEIPT_INVALID_FINGERPRINT`.
- **Integridade Transacional de Desfazimento:** Se um único item divergir em qualquer atributo (ex: `active` alterado para `false` ou `updatedAt` alterado após nova escrita), a transação é revertida integralmente com `ASSIGNMENT_CONFLICT` e nenhuma exclusão é efetuada.

---

## 7. Comandos Oficiais de Execução

```bash
# 1. Dry-Run (geração do manifesto fora do repositório)
npx --no-install tsx scripts/s2_backfill.ts

# 2. Apply (journal .pending pré-compromisso, escrita transacional e recibo definitivo)
npx --no-install tsx scripts/s2_backfill.ts \
  --apply \
  --manifest=/caminho/externo/manifesto.json \
  --checksum=<sha256_manifesto> \
  --receipt=/caminho/externo/recibo.json

# 3. Recuperação de Journal Pending (caso falhe I/O pós-commit)
npx --no-install tsx scripts/s2_backfill.ts \
  --recover-pending=/caminho/externo/recibo.json.pending \
  --checksum=<sha256_pending>

# 4. Rollback (desfazimento cirúrgico validando fingerprint completo)
npx --no-install tsx scripts/s2_backfill.ts \
  --rollback \
  --receipt=/caminho/externo/recibo.json \
  --checksum=<sha256_recibo>
```

---

## 8. Cobertura de Suíte de Testes (69 Testes S2 / 112 Total)
A suíte E2E em `test/e2e/multi_tenant/s2_backfill.test.ts` conta com 69 testes de segurança:

1 a 40. Testes da suíte anterior.
41. Mudança da Membership entre análise e transação é bloqueada
42. Mudança do papel dentro da transação é bloqueada
43. Falha transacional não gera recibo
44. Caminho de recibo dentro do repositório é rejeitado
45. Recibo preexistente não é sobrescrito
46. Falha na gravação pós-commit retorna erro e informa somente IDs
47. Arquivo temporário é removido após falha
48. Dry-run não grava manifesto dentro do repositório
49. active alterado para false bloqueia rollback
50. campo alterado e depois restaurado continua bloqueado pela divergência de updatedAt
51. conflito em um item entre vários impede a exclusão de todos
52. recibo sem active/createdAt/updatedAt é rejeitado
53. rollback normal com fingerprint intacto continua funcionando
54. falha ao criar .pending produz zero escritas
55. .pending existe antes da primeira escrita no banco
56. falha após commit preserva .pending e retorna RECOVERY_REQUIRED
57. recuperação com todos os registros promove o recibo
58. recuperação com zero registros trata transação não aplicada
59. recuperação parcial retorna PENDING_CONFLICT
60. fingerprint divergente retorna PENDING_CONFLICT
61. novo apply com pending existente é bloqueado
62. fluxo normal cria recibo e remove pending
63. --rollback rejeita arquivo pending
64. execução a partir de subpasta do repositório detecta raiz git e bloqueia recibo no repositório
65. temporário exato .tmp impede apply e preserva o arquivo
66. temporário com timestamp .tmp_12345 impede apply e preserva o arquivo
67. recuperação bloqueada por recibo definitivo existente
68. recuperação bloqueada por temporário do recibo definitivo
69. falha ao listar o diretório abortando de forma segura
