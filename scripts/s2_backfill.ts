import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { execSync } from 'child_process';

interface ManifestCandidate {
  userId: string;
  classId: string;
  organizationId: string;
  organizationMembershipId: string;
  assignmentRole: 'PROFESSOR' | 'AUXILIAR';
  plannedAssignmentId: string;
}

interface ManifestInvalid {
  userId: string;
  classId: string | null;
  reason: string;
}

interface BackfillManifest {
  runId: string;
  createdAt: string;
  host: string;
  dbName: string;
  candidatesCount: number;
  candidates: ManifestCandidate[];
  invalidCount: number;
  invalid: ManifestInvalid[];
}

interface ReceiptAssignmentItem {
  id: string;
  classId: string;
  organizationId: string;
  organizationMembershipId: string;
  assignmentRole: 'PROFESSOR' | 'AUXILIAR';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApplyReceipt {
  receiptVersion: '1.0';
  runId: string;
  sourceManifestChecksum: string;
  host: string;
  dbName: string;
  appliedAt: string;
  createdAssignments: ReceiptAssignmentItem[];
  alreadyAppliedAssignments: ReceiptAssignmentItem[];
}

interface PendingJournal {
  journalVersion: '1.0';
  status: 'PENDING';
  runId: string;
  sourceManifestChecksum: string;
  host: string;
  dbName: string;
  createdAt: string;
  createdAssignments: ReceiptAssignmentItem[];
  alreadyAppliedAssignments: ReceiptAssignmentItem[];
}

const ALLOWED_HOST = 'srv890.hstgr.io';
const ALLOWED_READ_DBS = ['u223033896_ebd_test', 'u223033896_ebd_dev'];
const ALLOWED_WRITE_DB = 'u223033896_ebd_test';
const DENIED_PROD_DB = 'u223033896_ebd2026';

function getGitRepositoryRoot(): string {
  try {
    const stdout = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const gitRoot = stdout.trim();
    if (!gitRoot) {
      throw new Error('Caminho vazio retornado pelo git rev-parse');
    }
    return path.resolve(gitRoot);
  } catch (e: any) {
    throw new Error('GIT_ROOT_UNDETERMINED: Não foi possível determinar a raiz do repositório Git');
  }
}

function isInsideRepository(targetPath: string): boolean {
  const gitRoot = getGitRepositoryRoot();
  const resolvedTarget = path.resolve(process.cwd(), targetPath);
  const relative = path.relative(gitRoot, resolvedTarget);

  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return true;
  }
  return false;
}

function hasAbandonedTmpFiles(targetPathResolved: string): boolean {
  const dir = path.dirname(targetPathResolved);
  if (!fs.existsSync(dir)) return false;

  const base = path.basename(targetPathResolved);
  const prefix = `${base}.tmp`;

  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch (e: any) {
    throw new Error(`TMP_CHECK_FAILED: Não foi possível verificar arquivos temporários em ${dir}: ${e.message}`);
  }

  return files.some((file) => file === prefix || file.startsWith(`${prefix}_`));
}

function parseArgs() {
  const args = process.argv.slice(2);
  let isApply = false;
  let isRollback = false;
  let isRecoverPending = false;
  let manifestPath: string | null = null;
  let checksum: string | null = null;
  let receiptPath: string | null = null;
  let pendingPath: string | null = null;

  for (const arg of args) {
    if (arg === '--apply') {
      isApply = true;
    } else if (arg === '--rollback') {
      isRollback = true;
    } else if (arg.startsWith('--recover-pending=')) {
      isRecoverPending = true;
      pendingPath = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--manifest=')) {
      manifestPath = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--checksum=')) {
      checksum = arg.split('=').slice(1).join('=');
    } else if (arg.startsWith('--receipt=')) {
      receiptPath = arg.split('=').slice(1).join('=');
    }
  }

  return { isApply, isRollback, isRecoverPending, manifestPath, checksum, receiptPath, pendingPath };
}

function validateDatabaseGuard(isWriteOperation: boolean) {
  const dbUrlStr = process.env.DATABASE_URL;
  if (!dbUrlStr) {
    throw new Error('DATABASE_URL não configurada');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(dbUrlStr);
  } catch (e) {
    throw new Error('DATABASE_URL inválida');
  }

  const host = parsedUrl.hostname;
  const dbName = parsedUrl.pathname.replace(/^\//, '');

  if (host !== ALLOWED_HOST) {
    throw new Error(`Host não autorizado: "${host}". Permissão concedida apenas para ${ALLOWED_HOST}`);
  }

  if (dbName === DENIED_PROD_DB || dbName.includes('ebd2026')) {
    throw new Error('Acesso a produção terminantemente proibido');
  }

  if (!ALLOWED_READ_DBS.includes(dbName)) {
    throw new Error(`Banco de dados desconhecido ou não autorizado: "${dbName}"`);
  }

  if (isWriteOperation && dbName !== ALLOWED_WRITE_DB) {
    throw new Error(`Restrito ao _test: modificações de dados não são permitidas no banco ${dbName}`);
  }

  return { dbName, host };
}

function computeChecksum(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function run() {
  const { isApply, isRollback, isRecoverPending, manifestPath, checksum, receiptPath, pendingPath } = parseArgs();
  const isWriteOp = isApply || isRollback || isRecoverPending;

  const { dbName, host } = validateDatabaseGuard(isWriteOp);

  const prisma = new PrismaClient();

  try {
    if (isRecoverPending) {
      if (!pendingPath) {
        throw new Error('Caminho do journal pending é obrigatório para recuperação (--recover-pending=<caminho>)');
      }
      if (!checksum) {
        throw new Error('Checksum do journal pending é obrigatório para a operação (--checksum=<hash>)');
      }

      if (isInsideRepository(pendingPath)) {
        throw new Error('Caminho do journal pending não pode ser dentro do repositório');
      }

      const pendingPathResolved = path.resolve(process.cwd(), pendingPath);

      const receiptPathResolved = pendingPathResolved.endsWith('.pending')
        ? pendingPathResolved.slice(0, -8)
        : `${pendingPathResolved}.receipt.json`;

      if (fs.existsSync(receiptPathResolved)) {
        throw new Error('Arquivo de recibo definitivo já existe e não pode ser sobrescrito');
      }

      if (hasAbandonedTmpFiles(receiptPathResolved)) {
        throw new Error('Arquivo temporário .tmp relacionado ao recibo já existe e não pode ser sobrescrito');
      }

      if (hasAbandonedTmpFiles(pendingPathResolved)) {
        throw new Error('Arquivo temporário .tmp relacionado ao journal pending já existe e não pode ser sobrescrito');
      }

      if (!fs.existsSync(pendingPathResolved)) {
        throw new Error(`Journal pending não encontrado em: ${pendingPathResolved}`);
      }

      const rawPending = fs.readFileSync(pendingPathResolved, 'utf8');
      const computedHash = computeChecksum(rawPending);
      if (computedHash !== checksum) {
        throw new Error('Checksum do journal pending adulterado');
      }

      const journal: PendingJournal = JSON.parse(rawPending);
      if (journal.dbName !== dbName || journal.host !== host) {
        throw new Error('Journal pending gerado para outro banco ou host');
      }

      if (journal.status !== 'PENDING') {
        throw new Error('Journal com formato ou status inválido');
      }

      const createdItems = journal.createdAssignments || [];
      const plannedIds = createdItems.map((item) => item.id);

      let existingCount = 0;
      if (plannedIds.length > 0) {
        existingCount = await prisma.classStaffAssignment.count({
          where: { id: { in: plannedIds } }
        });
      }

      // Scenario A: ALL exist -> check fingerprints and promote to final receipt
      if (existingCount === plannedIds.length) {
        for (const item of createdItems) {
          const existing = await prisma.classStaffAssignment.findUnique({ where: { id: item.id } });
          if (
            !existing ||
            existing.classId !== item.classId ||
            existing.organizationId !== item.organizationId ||
            existing.organizationMembershipId !== item.organizationMembershipId ||
            existing.assignmentRole !== item.assignmentRole ||
            existing.active !== item.active ||
            existing.createdAt.toISOString() !== item.createdAt ||
            existing.updatedAt.toISOString() !== item.updatedAt
          ) {
            throw new Error(`PENDING_CONFLICT: Assignment ${item.id} divergiu do journal durante a recuperação`);
          }
        }

        const receipt: ApplyReceipt = {
          receiptVersion: '1.0',
          runId: journal.runId,
          sourceManifestChecksum: journal.sourceManifestChecksum,
          host: journal.host,
          dbName: journal.dbName,
          appliedAt: journal.createdAt,
          createdAssignments: journal.createdAssignments,
          alreadyAppliedAssignments: journal.alreadyAppliedAssignments
        };

        const receiptJson = JSON.stringify(receipt, null, 2);
        const tmpReceiptPath = `${receiptPathResolved}.tmp_${Date.now()}`;
        fs.writeFileSync(tmpReceiptPath, receiptJson, { flag: 'wx', encoding: 'utf8' });
        fs.renameSync(tmpReceiptPath, receiptPathResolved);

        if (fs.existsSync(pendingPathResolved)) {
          fs.unlinkSync(pendingPathResolved);
        }

        console.log(`Recuperação concluída com sucesso: Recibo promovido para ${receiptPathResolved}`);
        return;
      }

      // Scenario B: ZERO exist -> confirm unapplied and remove pending
      if (existingCount === 0) {
        if (fs.existsSync(pendingPathResolved)) {
          fs.unlinkSync(pendingPathResolved);
        }
        console.log(`Recuperação concluída: Confirmado que a transação não foi aplicada. Journal pending removido.`);
        return;
      }

      // Scenario C: Partial existence -> PENDING_CONFLICT
      throw new Error(`PENDING_CONFLICT: Existência parcial de assignments (${existingCount}/${plannedIds.length}) detectada durante a recuperação`);
    }

    if (isRollback) {
      if (!receiptPath) {
        throw new Error('Caminho do recibo é obrigatório para rollback (--receipt=<caminho>)');
      }
      if (receiptPath.endsWith('.pending')) {
        throw new Error('O comando --rollback não aceita arquivos .pending. Use --recover-pending=<caminho> --checksum=<hash>');
      }
      if (isInsideRepository(receiptPath)) {
        throw new Error('Caminho do recibo não pode ser dentro do repositório');
      }
      if (!checksum) {
        throw new Error('Checksum do recibo é obrigatório para a operação (--checksum=<hash>)');
      }
      if (!fs.existsSync(receiptPath)) {
        throw new Error(`Recibo não encontrado em: ${receiptPath}`);
      }

      const rawReceipt = fs.readFileSync(receiptPath, 'utf8');
      if (rawReceipt.includes('"status": "PENDING"')) {
        throw new Error('O comando --rollback não aceita arquivos .pending. Use --recover-pending=<caminho> --checksum=<hash>');
      }

      const computedHash = computeChecksum(rawReceipt);
      if (computedHash !== checksum) {
        throw new Error('Checksum do recibo adulterado');
      }

      const receipt: ApplyReceipt = JSON.parse(rawReceipt);
      if (receipt.dbName !== dbName || receipt.host !== host) {
        throw new Error('Recibo gerado para outro banco ou host');
      }

      const createdItems = receipt.createdAssignments || [];
      const idsToDelete = createdItems.map((item) => item.id);

      await prisma.$transaction(
        async (tx) => {
          for (const item of createdItems) {
            if (
              typeof item.active !== 'boolean' ||
              typeof item.createdAt !== 'string' ||
              typeof item.updatedAt !== 'string' ||
              !item.id ||
              !item.classId ||
              !item.organizationId ||
              !item.organizationMembershipId ||
              !item.assignmentRole
            ) {
              throw new Error('RECEIPT_INVALID_FINGERPRINT: Recibo contém fingerprint incompleto ou legado');
            }

            const existing = await tx.classStaffAssignment.findUnique({
              where: { id: item.id }
            });

            if (
              !existing ||
              existing.classId !== item.classId ||
              existing.organizationId !== item.organizationId ||
              existing.organizationMembershipId !== item.organizationMembershipId ||
              existing.assignmentRole !== item.assignmentRole ||
              existing.active !== item.active ||
              existing.createdAt.toISOString() !== item.createdAt ||
              existing.updatedAt.toISOString() !== item.updatedAt
            ) {
              throw new Error(`ASSIGNMENT_CONFLICT: Assignment ${item.id} foi alterado ou não bate com o recibo`);
            }
          }

          if (idsToDelete.length > 0) {
            await tx.classStaffAssignment.deleteMany({
              where: {
                id: { in: idsToDelete }
              }
            });
          }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      console.log(`Rollback concluído com sucesso para runId: ${receipt.runId}`);
      return;
    }

    if (isApply) {
      if (!manifestPath) {
        throw new Error('Caminho do manifesto é obrigatório para apply (--manifest=<caminho>)');
      }
      if (!checksum) {
        throw new Error('Checksum do manifesto é obrigatório para a operação (--checksum=<hash>)');
      }
      if (!receiptPath) {
        throw new Error('Caminho do recibo é obrigatório para apply (--receipt=<caminho>)');
      }
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifesto não encontrado em: ${manifestPath}`);
      }

      const receiptPathResolved = path.resolve(process.cwd(), receiptPath);
      const manifestPathResolved = path.resolve(process.cwd(), manifestPath);
      const pendingPathResolved = `${receiptPathResolved}.pending`;

      if (isInsideRepository(receiptPath)) {
        throw new Error('Caminho do recibo não pode ser dentro do repositório');
      }

      if (
        fs.existsSync(receiptPathResolved) ||
        fs.existsSync(pendingPathResolved) ||
        hasAbandonedTmpFiles(receiptPathResolved) ||
        hasAbandonedTmpFiles(pendingPathResolved)
      ) {
        throw new Error('Arquivo de recibo, journal pending ou arquivo temporário .tmp já existe e não pode ser sobrescrito');
      }

      if (receiptPathResolved === manifestPathResolved) {
        throw new Error('Caminho do recibo não pode ser igual ao caminho do manifesto');
      }

      const rawManifest = fs.readFileSync(manifestPath, 'utf8');
      const computedHash = computeChecksum(rawManifest);
      if (computedHash !== checksum) {
        throw new Error('Checksum adulterado');
      }

      const manifest: BackfillManifest = JSON.parse(rawManifest);
      if (manifest.dbName !== dbName || manifest.host !== host) {
        throw new Error('Manifesto gerado para outro banco ou host');
      }

      const createdAssignments: ReceiptAssignmentItem[] = [];
      const alreadyAppliedAssignments: ReceiptAssignmentItem[] = [];
      const applyTimestamp = new Date();
      const applyIso = applyTimestamp.toISOString();

      // Read-only pre-validation & pre-generation of fingerprints
      for (const candidate of manifest.candidates) {
        const user = await prisma.user.findUnique({ where: { id: candidate.userId } });
        if (!user || user.classId !== candidate.classId) {
          throw new Error(`User ${candidate.userId} mudou de estado antes do compromisso`);
        }

        const cls = await prisma.class.findUnique({ where: { id: candidate.classId } });
        if (!cls || !cls.status || !cls.organizationId || cls.organizationId !== candidate.organizationId) {
          throw new Error(`Class ${candidate.classId} mudou de estado antes do compromisso`);
        }

        const org = await prisma.organization.findUnique({ where: { id: candidate.organizationId } });
        if (!org || !org.active) {
          throw new Error(`Organization ${candidate.organizationId} mudou de estado antes do compromisso`);
        }

        const mem = await prisma.organizationMembership.findUnique({
          where: { id: candidate.organizationMembershipId }
        });

        if (
          !mem ||
          mem.userId !== candidate.userId ||
          mem.organizationId !== candidate.organizationId ||
          mem.status !== 'ACTIVE'
        ) {
          throw new Error(`Membership ${candidate.organizationMembershipId} mudou de estado antes do compromisso`);
        }

        const expectedRole = mem.role === 'PROFESSOR' ? 'PROFESSOR' : mem.role === 'APOIO' ? 'AUXILIAR' : null;
        if (expectedRole !== candidate.assignmentRole) {
          throw new Error(`Membership ${mem.id} role mudou antes do compromisso`);
        }

        const existing = await prisma.classStaffAssignment.findUnique({
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
            alreadyAppliedAssignments.push({
              id: existing.id,
              classId: existing.classId,
              organizationId: existing.organizationId,
              organizationMembershipId: existing.organizationMembershipId,
              assignmentRole: existing.assignmentRole as any,
              active: existing.active,
              createdAt: existing.createdAt.toISOString(),
              updatedAt: existing.updatedAt.toISOString()
            });
          } else {
            throw new Error('ASSIGNMENT_CONFLICT: Conflito com Assignment existente divergente');
          }
        } else {
          createdAssignments.push({
            id: candidate.plannedAssignmentId,
            classId: candidate.classId,
            organizationId: candidate.organizationId,
            organizationMembershipId: candidate.organizationMembershipId,
            assignmentRole: candidate.assignmentRole,
            active: true,
            createdAt: applyIso,
            updatedAt: applyIso
          });
        }
      }

      // Pre-build PendingJournal
      const pendingJournal: PendingJournal = {
        journalVersion: '1.0',
        status: 'PENDING',
        runId: manifest.runId,
        sourceManifestChecksum: checksum,
        host,
        dbName,
        createdAt: applyIso,
        createdAssignments,
        alreadyAppliedAssignments
      };

      const pendingJson = JSON.stringify(pendingJournal, null, 2);
      const tmpPendingPath = `${pendingPathResolved}.tmp_${Date.now()}`;

      // Atomic write of .pending journal before DB write
      try {
        fs.writeFileSync(tmpPendingPath, pendingJson, { flag: 'wx', encoding: 'utf8' });
        fs.renameSync(tmpPendingPath, pendingPathResolved);
      } catch (err: any) {
        if (fs.existsSync(tmpPendingPath)) {
          try { fs.unlinkSync(tmpPendingPath); } catch (e) {}
        }
        throw new Error(`Falha na gravação do journal pending: ${err.message}`);
      }

      if (!fs.existsSync(pendingPathResolved)) {
        throw new Error('Journal pending não pôde ser verificado no disco');
      }

      // Re-read file from disk, validate JSON, recalculate SHA256 checksum and assert fingerprint match
      const diskPendingRaw = fs.readFileSync(pendingPathResolved, 'utf8');
      const diskPendingChecksum = computeChecksum(diskPendingRaw);
      const expectedPendingChecksum = computeChecksum(pendingJson);

      if (diskPendingChecksum !== expectedPendingChecksum) {
        throw new Error('PENDING_CHECKSUM_MISMATCH: Checksum do journal pending relido do disco diverge do plano em memória');
      }

      let parsedDiskJournal: PendingJournal;
      try {
        parsedDiskJournal = JSON.parse(diskPendingRaw);
      } catch (e) {
        throw new Error('PENDING_INVALID_JSON: Journal pending relido do disco contém JSON inválido');
      }

      if (
        parsedDiskJournal.runId !== pendingJournal.runId ||
        parsedDiskJournal.createdAssignments.length !== createdAssignments.length ||
        parsedDiskJournal.alreadyAppliedAssignments.length !== alreadyAppliedAssignments.length
      ) {
        throw new Error('PENDING_FINGERPRINT_MISMATCH: Fingerprint relido do disco não é idêntico ao plano em memória');
      }

      // Controlled test fault injection: after pending journal is written, re-read and validated, but BEFORE DB transaction starts
      if (
        process.env.NODE_ENV === 'test' &&
        dbName === ALLOWED_WRITE_DB &&
        process.env.S2_TEST_FAIL_AFTER_PENDING_BEFORE_TRANSACTION === '1'
      ) {
        console.error('TEST_STOP_AFTER_PENDING_BEFORE_TRANSACTION: Journal .pending escrito e validado antes da transação DB.');
        console.error(`O journal .pending foi PRESERVADO em: ${pendingPathResolved}`);
        process.exit(1);
      }

      // Step 2: Serializable Transaction in Prisma using pre-generated IDs & timestamps from journal
      try {
        await prisma.$transaction(
          async (tx) => {
            for (const candidate of manifest.candidates) {
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
                  existing.id !== candidate.plannedAssignmentId ||
                  existing.organizationId !== candidate.organizationId ||
                  existing.assignmentRole !== candidate.assignmentRole
                ) {
                  throw new Error('ASSIGNMENT_CONFLICT: Conflito com Assignment existente divergente');
                }
              } else {
                await tx.classStaffAssignment.create({
                  data: {
                    id: candidate.plannedAssignmentId,
                    classId: candidate.classId,
                    organizationId: candidate.organizationId,
                    organizationMembershipId: candidate.organizationMembershipId,
                    assignmentRole: candidate.assignmentRole,
                    active: true,
                    createdAt: applyTimestamp,
                    updatedAt: applyTimestamp
                  }
                });
              }
            }
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable
          }
        );
      } catch (txErr: any) {
        // Transaction failed in DB. Remove .pending journal file.
        if (fs.existsSync(pendingPathResolved)) {
          try { fs.unlinkSync(pendingPathResolved); } catch (e) {}
        }
        throw txErr;
      }

      // Step 3: Transaction committed. Promote journal to final receipt via .tmp + rename
      if (
        process.env.NODE_ENV === 'test' &&
        dbName === ALLOWED_WRITE_DB &&
        process.env.S2_TEST_FAIL_AFTER_COMMIT === '1'
      ) {
        console.error('RECOVERY_REQUIRED: Falha na gravação do recibo após commit.');
        console.error('IDs de ClassStaffAssignment criados:', createdAssignments.map((a) => a.id).join(', '));
        console.error(`O journal .pending foi PRESERVADO em: ${pendingPathResolved}`);
        console.error(`Execute recuperação com: --recover-pending="${pendingPathResolved}" --checksum=${computeChecksum(pendingJson)}`);
        process.exit(1);
      }

      const receipt: ApplyReceipt = {
        receiptVersion: '1.0',
        runId: manifest.runId,
        sourceManifestChecksum: checksum,
        host,
        dbName,
        appliedAt: applyIso,
        createdAssignments,
        alreadyAppliedAssignments
      };

      const receiptJson = JSON.stringify(receipt, null, 2);
      const receiptChecksum = computeChecksum(receiptJson);
      const tmpReceiptPath = `${receiptPathResolved}.tmp_${Date.now()}`;

      try {
        fs.writeFileSync(tmpReceiptPath, receiptJson, { flag: 'wx', encoding: 'utf8' });
        fs.renameSync(tmpReceiptPath, receiptPathResolved);

        // Remove .pending ONLY after final receipt is confirmed on disk
        if (fs.existsSync(receiptPathResolved) && fs.existsSync(pendingPathResolved)) {
          fs.unlinkSync(pendingPathResolved);
        }
      } catch (err: any) {
        // Post-commit receipt write failed: PRESERVE .pending journal
        console.error('RECOVERY_REQUIRED: Falha na gravação do recibo após commit.');
        console.error('IDs de ClassStaffAssignment criados:', createdAssignments.map((a) => a.id).join(', '));
        console.error(`O journal .pending foi PRESERVADO em: ${pendingPathResolved}`);
        console.error(`Execute recuperação com: --recover-pending="${pendingPathResolved}" --checksum=${computeChecksum(pendingJson)}`);
        process.exit(1);
      }

      console.log(`Apply concluído com sucesso.`);
      console.log(`Criados: ${createdAssignments.length}`);
      console.log(`Já aplicados: ${alreadyAppliedAssignments.length}`);
      console.log(`Recibo gerado: ${receiptPathResolved}`);
      console.log(`SHA-256 do recibo: ${receiptChecksum}`);
      return;
    }

    // Default: Dry-Run Mode
    if (manifestPath && isInsideRepository(manifestPath)) {
      throw new Error('Caminho do manifesto não pode ser dentro do repositório');
    }

    const usersWithClass = await prisma.user.findMany({
      where: {
        classId: { not: null }
      }
    });

    const candidates: ManifestCandidate[] = [];
    const invalid: ManifestInvalid[] = [];

    for (const user of usersWithClass) {
      if (!user.classId) continue;

      const cls = await prisma.class.findUnique({
        where: { id: user.classId }
      });

      if (!cls) {
        invalid.push({ userId: user.id, classId: user.classId, reason: 'CLASS_NOT_FOUND' });
        continue;
      }

      if (!cls.status) {
        invalid.push({ userId: user.id, classId: user.classId, reason: 'CLASS_INACTIVE' });
        continue;
      }

      if (!cls.organizationId) {
        invalid.push({ userId: user.id, classId: user.classId, reason: 'ORGANIZATION_NOT_FOUND' });
        continue;
      }

      const org = await prisma.organization.findUnique({
        where: { id: cls.organizationId }
      });

      if (!org) {
        invalid.push({ userId: user.id, classId: user.classId, reason: 'ORGANIZATION_NOT_FOUND' });
        continue;
      }

      if (!org.active) {
        invalid.push({ userId: user.id, classId: user.classId, reason: 'ORGANIZATION_INACTIVE' });
        continue;
      }

      const memberships = await prisma.organizationMembership.findMany({
        where: {
          userId: user.id,
          organizationId: cls.organizationId
        }
      });

      if (memberships.length === 0) {
        invalid.push({ userId: user.id, classId: user.classId, reason: 'MEMBERSHIP_NOT_FOUND' });
        continue;
      }

      const membership = memberships[0];

      if (membership.status !== 'ACTIVE') {
        invalid.push({ userId: user.id, classId: user.classId, reason: 'MEMBERSHIP_INACTIVE' });
        continue;
      }

      let assignmentRole: 'PROFESSOR' | 'AUXILIAR' | null = null;
      if (membership.role === 'PROFESSOR') {
        assignmentRole = 'PROFESSOR';
      } else if (membership.role === 'APOIO') {
        assignmentRole = 'AUXILIAR';
      } else {
        invalid.push({ userId: user.id, classId: user.classId, reason: 'UNSUPPORTED_MEMBERSHIP_ROLE' });
        continue;
      }

      const plannedAssignmentId = `csa-backfill-${user.id}-${cls.id}`;

      candidates.push({
        userId: user.id,
        classId: cls.id,
        organizationId: cls.organizationId,
        organizationMembershipId: membership.id,
        assignmentRole,
        plannedAssignmentId
      });
    }

    const runId = `run-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const manifest: BackfillManifest = {
      runId,
      createdAt: new Date().toISOString(),
      host,
      dbName,
      candidatesCount: candidates.length,
      candidates,
      invalidCount: invalid.length,
      invalid
    };

    const manifestJson = JSON.stringify(manifest, null, 2);
    const checksumHash = computeChecksum(manifestJson);

    const targetManifestPath = manifestPath
      ? path.resolve(process.cwd(), manifestPath)
      : path.join(os.tmpdir(), `s2_manifest_${runId}.json`);

    fs.writeFileSync(targetManifestPath, manifestJson, 'utf8');

    console.log(`Dry-run concluído com sucesso.`);
    console.log(`Candidatos elegíveis: ${candidates.length}`);
    console.log(`Registros inválidos/ignorados: ${invalid.length}`);
    console.log(`Manifesto gerado em: ${targetManifestPath}`);
    console.log(`SHA-256 do manifesto: ${checksumHash}`);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('Erro na execução:', err.message || err);
  process.exit(1);
});