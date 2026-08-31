import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const orgId = 'org-s2-test';
const classId = 'class-s2-test';
let currentUserId = '';
let currentMembershipId = '';

let suiteTmpDir: string = '';
let currentTestTmpDir: string = '';

// Suite permanent audit sets
const allCreatedAssignmentIds = new Set<string>();
const allCreatedMembershipIds = new Set<string>();
const allCreatedUserIds = new Set<string>();
const allCreatedClassIds = new Set<string>();
const allCreatedOrgIds = new Set<string>();

function isSubdirectory(parentDir: string, childDir: string): boolean {
  const relative = path.relative(parentDir, childDir);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function runScript(args: string[] = [], envOverrides?: Record<string, string>, cwdOverride?: string): string {
  const scriptPath = path.resolve(__dirname, '../../../scripts/s2_backfill.ts');
  const tsxBin = path.resolve(__dirname, '../../../node_modules/tsx/dist/cli.mjs');

  const env = { ...process.env, ...envOverrides };

  const testFaultVariables = [
    'S2_TEST_FAIL_AFTER_COMMIT',
    'S2_TEST_FAIL_AFTER_PENDING_BEFORE_TRANSACTION'
  ];

  for (const variable of testFaultVariables) {
    if (!envOverrides || !(variable in envOverrides)) {
      delete process.env[variable];
      delete env[variable];
    }
  }

  const options: any = {
    env,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 30000,
    shell: false
  };
  if (cwdOverride) {
    options.cwd = cwdOverride;
  }
  try {
    return execFileSync(process.execPath, [tsxBin, scriptPath, ...args], options) as string;
  } catch (e: any) {
    const stdout = e.stdout ? e.stdout.toString() : '';
    const stderr = e.stderr ? e.stderr.toString() : '';
    throw new Error(stdout + stderr + (e.message || ''));
  }
}

describe('S2 Backfill Tool - Permanent Suite (69 Tests)', () => {
  const trackedOrgIds = new Set<string>([orgId]);
  const trackedClassIds = new Set<string>([classId]);
  const trackedUserIds = new Set<string>();
  const trackedMembershipIds = new Set<string>();
  const trackedAssignmentIds = new Set<string>();

  function trackOrg(id: string) {
    trackedOrgIds.add(id);
    allCreatedOrgIds.add(id);
    return id;
  }

  function trackClass(id: string) {
    trackedClassIds.add(id);
    allCreatedClassIds.add(id);
    return id;
  }

  function trackUser(id: string) {
    trackedUserIds.add(id);
    allCreatedUserIds.add(id);
    return id;
  }

  function trackMembership(id: string) {
    trackedMembershipIds.add(id);
    allCreatedMembershipIds.add(id);
    return id;
  }

  function trackAssignment(id: string) {
    trackedAssignmentIds.add(id);
    allCreatedAssignmentIds.add(id);
    return id;
  }

  function registerPendingAssignmentIds(pendingPath: string): string[] {
    if (!fs.existsSync(pendingPath)) {
      throw new Error(`PERMANENT_TRACKING_ERROR: Arquivo .pending não encontrado em ${pendingPath}`);
    }
    const raw = fs.readFileSync(pendingPath, 'utf8');
    const journal = JSON.parse(raw);
    const ids: string[] = [];

    if (journal.createdAssignments && Array.isArray(journal.createdAssignments)) {
      for (const item of journal.createdAssignments) {
        if (item.id) {
          trackAssignment(item.id);
          ids.push(item.id);
        }
      }
    }
    return ids;
  }

  async function cleanupTrackedIds(includeBaseFixtures: boolean = false) {
    const assignmentIds = Array.from(trackedAssignmentIds);
    const membershipIds = Array.from(trackedMembershipIds);
    const userIds = Array.from(trackedUserIds);

    const classesToDelete = includeBaseFixtures
      ? Array.from(trackedClassIds)
      : Array.from(trackedClassIds).filter((id) => id !== classId);

    const orgsToDelete = includeBaseFixtures
      ? Array.from(trackedOrgIds)
      : Array.from(trackedOrgIds).filter((id) => id !== orgId);

    await prisma.$transaction(async (tx) => {
      if (assignmentIds.length > 0) {
        await tx.classStaffAssignment.deleteMany({
          where: { id: { in: assignmentIds } }
        });
      }

      if (membershipIds.length > 0) {
        await tx.organizationMembership.deleteMany({
          where: { id: { in: membershipIds } }
        });
      }

      if (userIds.length > 0) {
        await tx.user.deleteMany({
          where: { id: { in: userIds } }
        });
      }

      if (classesToDelete.length > 0) {
        await tx.class.deleteMany({
          where: { id: { in: classesToDelete } }
        });
      }

      if (orgsToDelete.length > 0) {
        await tx.organization.deleteMany({
          where: { id: { in: orgsToDelete } }
        });
      }
    });

    trackedAssignmentIds.clear();
    if (!includeBaseFixtures) {
      trackedMembershipIds.clear();
      trackedUserIds.clear();
    }
    classesToDelete.forEach((id) => trackedClassIds.delete(id));
    orgsToDelete.forEach((id) => trackedOrgIds.delete(id));
  }

  beforeAll(async () => {
    suiteTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 's2_test_suite_'));
    trackOrg(orgId);
    trackClass(classId);
    await resetOrgAndClass();
  });

  beforeEach(async () => {
    currentTestTmpDir = fs.mkdtempSync(path.join(suiteTmpDir, 'test_case_'));
    await resetOrgAndClass();
  });

  afterEach(async () => {
    // 1. Cleanup exact IDs in database
    await cleanupTrackedIds(false);

    // 2. Remove currentTestTmpDir only after successful DB cleanup
    if (currentTestTmpDir && isSubdirectory(suiteTmpDir, currentTestTmpDir) && fs.existsSync(currentTestTmpDir)) {
      fs.rmSync(currentTestTmpDir, { recursive: true, force: true });
    }

    // 3. Clear references
    currentUserId = '';
    currentMembershipId = '';
  });

  afterAll(async () => {
    try {
      // 1. Final exact DB cleanup
      await cleanupTrackedIds(true);

      // 2. Verify all assignments in permanent audit set
      const assignmentIdsToVerify = Array.from(allCreatedAssignmentIds);
      const remainingAssignments = assignmentIdsToVerify.length > 0
        ? await prisma.classStaffAssignment.count({ where: { id: { in: assignmentIdsToVerify } } })
        : 0;

      console.log('[Sanitized Log] AFTER_ALL_CLEANUP_EXECUTED');
      console.log(`[Sanitized Log] REMAINING_ASSIGNMENTS_AUDIT: ${remainingAssignments}`);

      expect(remainingAssignments).toBe(0);

      // 3. Remove suiteTmpDir
      if (suiteTmpDir && isSubdirectory(os.tmpdir(), suiteTmpDir) && fs.existsSync(suiteTmpDir)) {
        fs.rmSync(suiteTmpDir, { recursive: true, force: true });
      }

      // 4. Confirm suiteTmpDir no longer exists
      expect(fs.existsSync(suiteTmpDir)).toBe(false);
    } finally {
      await prisma.$disconnect();
    }
  });

  async function resetOrgAndClass() {
    trackOrg(orgId);
    trackClass(classId);
    await prisma.organization.upsert({
      where: { id: orgId },
      create: { id: orgId, name: 'S2 Org', slug: 's2-org', active: true },
      update: { active: true }
    });
    await prisma.class.upsert({
      where: { id: classId },
      create: { id: classId, name: 'S2 Class', organizationId: orgId, status: true },
      update: { status: true }
    });
  }

  async function createTestUser(role: string = 'PROFESSOR', status: string = 'ACTIVE', modifyClassId: boolean = true, activeOrg: boolean = true, activeClass: boolean = true) {
    await cleanupTrackedIds(false);

    currentUserId = 'user-s2-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    currentMembershipId = 'mem-s2-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    trackUser(currentUserId);
    if (role !== 'NO_MEMBERSHIP') {
      trackMembership(currentMembershipId);
    }

    await resetOrgAndClass();

    if (!activeOrg) await prisma.organization.update({ where: { id: orgId }, data: { active: false } });
    if (!activeClass) await prisma.class.update({ where: { id: classId }, data: { status: false } });

    await prisma.user.create({
      data: {
        id: currentUserId,
        name: 'Test User',
        email: currentUserId + '@test.com',
        classId: modifyClassId ? classId : null,
        password: 'hashedpassword'
      }
    });

    if (role !== 'NO_MEMBERSHIP') {
      await prisma.organizationMembership.create({
        data: {
          id: currentMembershipId,
          userId: currentUserId,
          organizationId: orgId,
          role: role as any,
          status: status
        }
      });
    }
  }

  function parseManifest(stdout: string): { manifestPath: string; manifest: any } | null {
    const match = stdout.match(/Manifesto gerado (?:em: |: )(.+)/);
    if (match) {
      const manifestPath = match[1].trim();
      if (fs.existsSync(manifestPath)) {
        const content = fs.readFileSync(manifestPath, 'utf8');
        return { manifestPath, manifest: JSON.parse(content) };
      }
    }
    return null;
  }

  function getHash(stdout: string) {
    const match = stdout.match(/SHA-256 (?:do manifesto: |: )(.+)/);
    return match ? match[1].trim() : null;
  }

  function parseReceipt(stdout: string) {
    const match = stdout.match(/Recibo gerado (?:em: |: )(.+)/) || stdout.match(/Recibo gerado: (.+)/);
    if (match) {
      const receiptPath = match[1].trim();
      if (fs.existsSync(receiptPath)) {
        const content = fs.readFileSync(receiptPath, 'utf8');
        const receipt = JSON.parse(content);
        if (receipt.createdAssignments) {
          receipt.createdAssignments.forEach((a: any) => {
            if (a.id) trackAssignment(a.id);
          });
        }
        return { receiptPath, receipt };
      }
    }
    return null;
  }

  function getReceiptHash(stdout: string) {
    const match = stdout.match(/SHA-256 do recibo: (.+)/);
    return match ? match[1].trim() : null;
  }

  function getExternalPath(filename: string) {
    return path.join(currentTestTmpDir, filename);
  }

  function generateIsolatedManifest() {
    const mPath = getExternalPath(`manifest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.json`);
    const out = runScript([`--manifest=${mPath}`]);
    const parsed = parseManifest(out);
    const hash = getHash(out);
    return { out, manifestPath: parsed?.manifestPath || mPath, manifest: parsed?.manifest, hash };
  }

  // 1. PROFESSOR gera candidato PROFESSOR
  it('1. PROFESSOR gera candidato PROFESSOR', async () => {
    await createTestUser('PROFESSOR');
    const { manifest } = generateIsolatedManifest();
    expect(manifest.candidatesCount).toBe(1);
    expect(manifest.candidates[0].assignmentRole).toBe('PROFESSOR');
  });

  // 2. APOIO gera candidato AUXILIAR
  it('2. APOIO gera candidato AUXILIAR', async () => {
    await createTestUser('APOIO');
    const { manifest } = generateIsolatedManifest();
    expect(manifest.candidatesCount).toBe(1);
    expect(manifest.candidates[0].assignmentRole).toBe('AUXILIAR');
  });

  // 3. ADMIN é bloqueado como papel não suportado
  it('3. ADMIN é bloqueado como papel não suportado', async () => {
    await createTestUser('ADMIN');
    const { manifest } = generateIsolatedManifest();
    expect(manifest.invalidCount).toBe(1);
    expect(manifest.invalid[0].reason).toBe('UNSUPPORTED_MEMBERSHIP_ROLE');
  });

  // 4. DIRIGENTE é bloqueado
  it('4. DIRIGENTE é bloqueado', async () => {
    await createTestUser('DIRIGENTE');
    const { manifest } = generateIsolatedManifest();
    expect(manifest.invalidCount).toBe(1);
    expect(manifest.invalid[0].reason).toBe('UNSUPPORTED_MEMBERSHIP_ROLE');
  });

  // 5. VICE_DIRIGENTE é bloqueado
  it('5. VICE_DIRIGENTE é bloqueado', async () => {
    await createTestUser('VICE_DIRIGENTE');
    const { manifest } = generateIsolatedManifest();
    expect(manifest.invalidCount).toBe(1);
    expect(manifest.invalid[0].reason).toBe('UNSUPPORTED_MEMBERSHIP_ROLE');
  });

  // 6. Membership inexistente é bloqueada
  it('6. Membership inexistente é bloqueada', async () => {
    await createTestUser('NO_MEMBERSHIP');
    const { manifest } = generateIsolatedManifest();
    expect(manifest.invalidCount).toBe(1);
    expect(manifest.invalid[0].reason).toBe('MEMBERSHIP_NOT_FOUND');
  });

  // 7. Membership inativa é bloqueada
  it('7. Membership inativa é bloqueada', async () => {
    await createTestUser('PROFESSOR', 'INACTIVE');
    const { manifest } = generateIsolatedManifest();
    expect(manifest.invalidCount).toBe(1);
    expect(manifest.invalid[0].reason).toBe('MEMBERSHIP_INACTIVE');
  });

  // 8. Organization inativa é bloqueada
  it('8. Organization inativa é bloqueada', async () => {
    await createTestUser('PROFESSOR', 'ACTIVE', true, false, true);
    const { manifest } = generateIsolatedManifest();
    expect(manifest.invalidCount).toBe(1);
    expect(manifest.invalid[0].reason).toBe('ORGANIZATION_INACTIVE');
  });

  // 9. Class inativa é bloqueada
  it('9. Class inativa é bloqueada', async () => {
    await createTestUser('PROFESSOR', 'ACTIVE', true, true, false);
    const { manifest } = generateIsolatedManifest();
    expect(manifest.invalidCount).toBe(1);
    expect(manifest.invalid[0].reason).toBe('CLASS_INACTIVE');
  });

  // 10. classId adulterado no manifesto é bloqueado antes da transação
  it('10. classId adulterado no manifesto é bloqueado antes da transação', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, manifest } = generateIsolatedManifest();
    const rPath = getExternalPath('r.json');

    manifest.candidates[0].classId = 'non-existent-class-' + Date.now();
    const tamperedContent = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(manifestPath, tamperedContent, 'utf8');
    const tamperedHash = crypto.createHash('sha256').update(tamperedContent, 'utf8').digest('hex');

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${tamperedHash}`, `--receipt=${rPath}`]);
    }).toThrow(/User .* mudou de estado antes do compromisso/);

    // Pós-condições obrigatórias:
    // 1. ClassStaffAssignment count === 0
    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(0);

    // 2. Recibo definitivo não existe
    expect(fs.existsSync(rPath)).toBe(false);

    // 3. Journal pending não existe
    expect(fs.existsSync(`${rPath}.pending`)).toBe(false);
  });

  // 11. relação de outra organização é bloqueada
  it('11. relação de outra organização é bloqueada', async () => {
    await createTestUser('PROFESSOR');
    const otherOrgId = 'other-org-' + Date.now();
    const otherClassId = 'other-class-' + Date.now();

    trackOrg(otherOrgId);
    trackClass(otherClassId);

    await prisma.organization.create({ data: { id: otherOrgId, name: 'O', slug: 'o-' + Date.now(), active: true } });
    await prisma.class.create({ data: { id: otherClassId, name: 'C', organizationId: otherOrgId, status: true } });

    await prisma.user.update({ where: { id: currentUserId }, data: { classId: otherClassId } });
    const { manifest } = generateIsolatedManifest();
    expect(manifest.invalidCount).toBe(1);
    expect(manifest.invalid[0].reason).toBe('MEMBERSHIP_NOT_FOUND');
  });

  // 12. dry-run não escreve
  it('12. dry-run não escreve', async () => {
    await createTestUser('PROFESSOR');
    generateIsolatedManifest();
    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(0);
  });

  // 13. apply cria somente o Assignment manifestado e gera recibo
  it('13. apply cria somente o Assignment manifestado e gera recibo', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_test_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const receiptData = parseReceipt(applyOut);
    expect(receiptData?.receipt.createdAssignments.length).toBe(1);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(1);
  });

  // 14. segundo apply registra Assignment como já aplicado, sem duplicar
  it('14. segundo apply registra Assignment como já aplicado, sem duplicar', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath1 = getExternalPath(`receipt_test1_${Date.now()}.json`);
    const rPath2 = getExternalPath(`receipt_test2_${Date.now()}.json`);

    runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath1}`]);
    const applyOut2 = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath2}`]);
    const receiptData2 = parseReceipt(applyOut2);

    expect(receiptData2?.receipt.createdAssignments.length).toBe(0);
    expect(receiptData2?.receipt.alreadyAppliedAssignments.length).toBe(1);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(1);
  });

  // 15. Assignment existente é preservado
  it('15. Assignment existente é preservado', async () => {
    await createTestUser('PROFESSOR');
    const plannedId = `csa-backfill-${currentUserId}-${classId}`;
    trackAssignment(plannedId);
    await prisma.classStaffAssignment.create({
      data: {
        id: plannedId,
        classId: classId,
        organizationId: orgId,
        organizationMembershipId: currentMembershipId,
        assignmentRole: 'PROFESSOR',
        active: true
      }
    });

    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_15_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const receiptData = parseReceipt(applyOut);

    expect(receiptData?.receipt.createdAssignments.length).toBe(0);
    expect(receiptData?.receipt.alreadyAppliedAssignments.length).toBe(1);
    expect(receiptData?.receipt.alreadyAppliedAssignments[0].id).toBe(plannedId);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(1);
  });

  // 16. checksum adulterado é rejeitado
  it('16. checksum adulterado é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath } = generateIsolatedManifest();
    const rPath = getExternalPath('r.json');

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, '--checksum=invalidhash12345', `--receipt=${rPath}`]);
    }).toThrow(/Checksum adulterado/);
  });

  // 17. manifesto de outro banco é rejeitado
  it('17. manifesto de outro banco é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, manifest } = generateIsolatedManifest();
    const rPath = getExternalPath('r.json');

    manifest.dbName = 'u223033896_other_db';
    const modifiedContent = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(manifestPath, modifiedContent, 'utf8');
    const tamperedHash = crypto.createHash('sha256').update(modifiedContent).digest('hex');

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${tamperedHash}`, `--receipt=${rPath}`]);
    }).toThrow(/Manifesto gerado para outro banco ou host/);
  });

  // 18. apply no _dev é rejeitado
  it('18. apply no _dev é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath('r.json');

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`], {
        DATABASE_URL: 'mysql://u223033896_ebd_dev2026:mock_pass_dev@srv890.hstgr.io:3306/u223033896_ebd_dev'
      });
    }).toThrow(/Restrito ao _test/);
  });

  // 19. produção é rejeitada antes da criação/conexão do PrismaClient
  it('19. produção é rejeitada', async () => {
    expect(() => {
      runScript([], {
        DATABASE_URL: 'mysql://u223033896_ebd2026:mock_pass_prod@srv890.hstgr.io:3306/u223033896_ebd2026'
      });
    }).toThrow(/Acesso a produção terminantemente proibido/);
  });

  // 20. rollback remove somente os IDs criados pelo recibo
  it('20. rollback remove somente os IDs criados pelo recibo', async () => {
    await createTestUser('PROFESSOR');

    const presetUser = 'user-preset-' + Date.now();
    const presetMem = 'mem-preset-' + Date.now();
    const presetClass = 'class-preset-' + Date.now();
    trackUser(presetUser);
    trackMembership(presetMem);
    trackClass(presetClass);

    await prisma.class.create({ data: { id: presetClass, name: 'PC', organizationId: orgId, status: true } });
    await prisma.user.create({ data: { id: presetUser, name: 'PU', email: presetUser + '@t.com', password: 'p' } });
    await prisma.organizationMembership.create({ data: { id: presetMem, userId: presetUser, organizationId: orgId, role: 'APOIO', status: 'ACTIVE' } });

    const presetId = 'do-not-delete-' + Date.now();
    trackAssignment(presetId);
    await prisma.classStaffAssignment.create({
      data: {
        id: presetId,
        classId: presetClass,
        organizationId: orgId,
        organizationMembershipId: presetMem,
        assignmentRole: 'AUXILIAR'
      }
    });

    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_test_rb_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const rHash = getReceiptHash(applyOut);

    let count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(2);

    runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`]);

    count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(1);

    const rem = await prisma.classStaffAssignment.findUnique({ where: { id: presetId } });
    expect(rem).not.toBeNull();
  });

  // 21. User.classId permanece inalterado
  it('21. User.classId permanece inalterado', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_u_${Date.now()}.json`);

    runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);

    const u = await prisma.user.findUnique({ where: { id: currentUserId } });
    expect(u?.classId).toBe(classId);
  });

  // 22. falha intermediária realiza rollback transacional
  it('22. falha intermediária realiza rollback transacional', async () => {
    await createTestUser('PROFESSOR');

    const u2 = 'user-22-' + Date.now();
    const m2 = 'mem-22-' + Date.now();
    trackUser(u2);
    trackMembership(m2);

    await prisma.user.create({ data: { id: u2, name: 'U2', email: u2 + '@t.com', classId: classId, password: 'p' } });
    await prisma.organizationMembership.create({ data: { id: m2, userId: u2, organizationId: orgId, role: 'PROFESSOR', status: 'ACTIVE' } });

    const { manifestPath, manifest, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_tx_${Date.now()}.json`);

    manifest.candidates[1].plannedAssignmentId = manifest.candidates[0].plannedAssignmentId;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    const newHash = crypto.createHash('sha256').update(JSON.stringify(manifest, null, 2)).digest('hex');

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${newHash}`, `--receipt=${rPath}`]);
    }).toThrow();

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(0);
  });

  // 23. cleanup final deixa o _test zerado
  it('23. cleanup final deixa o _test zerado', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_clean_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const rHash = getReceiptHash(applyOut);

    runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`]);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(0);
  });

  // 24. rollback sem checksum é recusado
  it('24. rollback sem checksum é recusado', async () => {
    const rPath = getExternalPath('r.json');
    expect(() => {
      runScript(['--rollback', `--receipt=${rPath}`]);
    }).toThrow(/Checksum do recibo é obrigatório/);
  });

  // 25. apply sem checksum é rejeitado
  it('25. apply sem checksum é rejeitado', async () => {
    const mPath = getExternalPath('m.json');
    const rPath = getExternalPath('r.json');
    expect(() => {
      runScript(['--apply', `--manifest=${mPath}`, `--receipt=${rPath}`]);
    }).toThrow(/Checksum do manifesto é obrigatório/);
  });

  // 26. rollback no _dev é rejeitado
  it('26. rollback no _dev é rejeitado', async () => {
    const rPath = getExternalPath('r.json');
    expect(() => {
      runScript(['--rollback', `--receipt=${rPath}`, '--checksum=dummy'], {
        DATABASE_URL: 'mysql://u223033896_ebd_dev2026:mock_pass_dev@srv890.hstgr.io:3306/u223033896_ebd_dev'
      });
    }).toThrow(/Restrito ao _test/);
  });

  // 27. host não autorizado é rejeitado
  it('27. host não autorizado é rejeitado', async () => {
    expect(() => {
      runScript([], {
        DATABASE_URL: 'mysql://root:pass@localhost:3306/u223033896_ebd_test'
      });
    }).toThrow(/Host não autorizado/);
  });

  // 28. banco desconhecido é rejeitado até em dry-run
  it('28. banco desconhecido é rejeitado até em dry-run', async () => {
    expect(() => {
      runScript([], {
        DATABASE_URL: 'mysql://user:pass@srv890.hstgr.io:3306/unknown_db'
      });
    }).toThrow(/Banco de dados desconhecido ou não autorizado/);
  });

  // 29. manifesto com host diferente é rejeitado
  it('29. manifesto com host diferente é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, manifest } = generateIsolatedManifest();
    const rPath = getExternalPath('r.json');

    manifest.host = 'otherhost.com';
    const content = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(manifestPath, content, 'utf8');
    const newHash = crypto.createHash('sha256').update(content).digest('hex');

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${newHash}`, `--receipt=${rPath}`]);
    }).toThrow(/Manifesto gerado para outro banco ou host/);
  });

  // 30. Membership cujo userId mudou invalida o snapshot
  it('30. Membership cujo userId mudou invalida o snapshot', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath('r.json');

    const otherUser = 'other-user-' + Date.now();
    trackUser(otherUser);
    await prisma.user.create({ data: { id: otherUser, name: 'OU', email: otherUser + '@t.com', password: 'p' } });
    await prisma.organizationMembership.update({ where: { id: currentMembershipId }, data: { userId: otherUser } });

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/mudou de estado/);
  });

  // 31. Membership cuja organizationId mudou invalida o snapshot
  it('31. Membership cuja organizationId mudou invalida o snapshot', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath('r.json');

    const otherOrg = 'other-org-' + Date.now();
    trackOrg(otherOrg);
    await prisma.organization.create({ data: { id: otherOrg, name: 'OO', slug: 'oo-' + Date.now(), active: true } });
    await prisma.organizationMembership.update({ where: { id: currentMembershipId }, data: { organizationId: otherOrg } });

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/mudou de estado/);
  });

  // 32. Membership cujo role mudou invalida o snapshot
  it('32. Membership cujo role mudou invalida o snapshot', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath('r.json');

    await prisma.organizationMembership.update({ where: { id: currentMembershipId }, data: { role: 'ADMIN' } });

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/role mudou/);
  });

  // 33. Assignment conflitante não é sobrescrito
  it('33. Assignment conflitante não é sobrescrito', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath('r.json');

    const conflictId = 'conflict-id-' + Date.now();
    trackAssignment(conflictId);
    await prisma.classStaffAssignment.create({
      data: {
        id: conflictId,
        classId: classId,
        organizationId: orgId,
        organizationMembershipId: currentMembershipId,
        assignmentRole: 'AUXILIAR'
      }
    });

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/ASSIGNMENT_CONFLICT/);
  });

  // 34. apply gera recibo somente com IDs realmente criados
  it('34. apply gera recibo somente com IDs realmente criados', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_created_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const receiptData = parseReceipt(applyOut);

    expect(receiptData?.receipt.createdAssignments.length).toBe(1);
    expect(receiptData?.receipt.alreadyAppliedAssignments.length).toBe(0);
  });

  // 35. segundo apply registra Assignment como já aplicado, sem duplicar
  it('35. segundo apply registra Assignment como já aplicado, sem duplicar', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath1 = getExternalPath(`receipt_first_${Date.now()}.json`);
    const rPath2 = getExternalPath(`receipt_second_${Date.now()}.json`);

    runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath1}`]);
    const applyOut2 = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath2}`]);
    const receiptData2 = parseReceipt(applyOut2);

    expect(receiptData2?.receipt.createdAssignments.length).toBe(0);
    expect(receiptData2?.receipt.alreadyAppliedAssignments.length).toBe(1);
  });

  // 36. rollback remove somente createdAssignments do recibo
  it('36. rollback remove somente createdAssignments do recibo', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath1 = getExternalPath(`receipt_first_36_${Date.now()}.json`);
    const rPath2 = getExternalPath(`receipt_second_36_${Date.now()}.json`);

    const applyOut1 = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath1}`]);
    const applyOut2 = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath2}`]);
    const rHash2 = getReceiptHash(applyOut2);

    runScript(['--rollback', `--receipt=${rPath2}`, `--checksum=${rHash2}`]);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(1);
  });

  // 37. rollback preserva alreadyAppliedAssignments
  it('37. rollback preserva alreadyAppliedAssignments', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath1 = getExternalPath(`receipt_a_${Date.now()}.json`);
    const rPath2 = getExternalPath(`receipt_b_${Date.now()}.json`);

    runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath1}`]);
    const applyOut2 = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath2}`]);
    const rHash2 = getReceiptHash(applyOut2);

    runScript(['--rollback', `--receipt=${rPath2}`, `--checksum=${rHash2}`]);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(1);
  });

  // 38. rollback rejeita Assignment cujos campos foram alterados
  it('38. rollback rejeita Assignment cujos campos foram alterados', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_38_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const rHash = getReceiptHash(applyOut);
    const receiptData = parseReceipt(applyOut);
    const createdId = receiptData?.receipt.createdAssignments[0].id;

    await prisma.classStaffAssignment.update({ where: { id: createdId }, data: { assignmentRole: 'AUXILIAR' } });

    expect(() => {
      runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`]);
    }).toThrow(/ASSIGNMENT_CONFLICT: Assignment .* foi alterado ou não bate com o recibo/);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(1);
  });

  // 39. recibo adulterado é rejeitado
  it('39. recibo adulterado é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_39_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    parseReceipt(applyOut);

    const rContent = fs.readFileSync(rPath, 'utf8');
    const modifiedR = rContent.replace('PROFESSOR', 'AUXILIAR');
    fs.writeFileSync(rPath, modifiedR, 'utf8');
    const tamperedRHash = crypto.createHash('sha256').update(modifiedR).digest('hex');

    expect(() => {
      runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${tamperedRHash}`]);
    }).toThrow(/recibo/i);
  });

  // 40. produção é recusada antes da criação/conexão do PrismaClient
  it('40. produção é recusada antes da criação/conexão do PrismaClient', async () => {
    expect(() => {
      runScript([], {
        DATABASE_URL: 'mysql://u223033896_ebd2026:mock_pass_prod@srv890.hstgr.io:3306/u223033896_ebd2026'
      });
    }).toThrow(/Acesso a produção terminantemente proibido/);
  });

  // 41. mudança da Membership entre análise e transação é bloqueada
  it('41. mudança da Membership entre análise e transação é bloqueada', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath('r.json');

    await prisma.organizationMembership.update({ where: { id: currentMembershipId }, data: { status: 'INACTIVE' } });

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/Membership .* (?:mudou de estado antes do compromisso|mudou de estado durante a transação)/);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(0);
  });

  // 42. mudança do papel dentro da transação é bloqueada
  it('42. mudança do papel dentro da transação é bloqueada', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath('r.json');

    await prisma.organizationMembership.update({ where: { id: currentMembershipId }, data: { role: 'ADMIN' } });

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/Membership .* role mudou (?:antes do compromisso|durante a transação)/);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(0);
  });

  // 43. falha transacional não gera recibo
  it('43. falha transacional não gera recibo', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, manifest } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_fail_${Date.now()}.json`);

    manifest.candidates[0].classId = 'non-existent-class-id';
    const content = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(manifestPath, content, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow();

    expect(fs.existsSync(rPath)).toBe(false);
  });

  // 44. caminho de recibo dentro do repositório é rejeitado
  it('44. caminho de recibo dentro do repositório é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const repoRPath = path.resolve(__dirname, '../../../receipt_in_repo.json');

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${repoRPath}`]);
    }).toThrow(/Caminho do recibo não pode ser dentro do repositório/);
  });

  // 45. recibo preexistente não é sobrescrito
  it('45. recibo preexistente não é sobrescrito', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_preexist_${Date.now()}.json`);
    fs.writeFileSync(rPath, '{}', 'utf8');

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/já existe/);
  });

  // 46. falha na gravação pós-commit retorna erro e informa somente IDs
  it('46. falha na gravação pós-commit retorna erro e informa somente IDs', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_46_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;

    try {
      runScript(
        ['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`],
        { S2_TEST_FAIL_AFTER_COMMIT: '1' }
      );
      expect.fail('Deveria ter falhado na gravação do recibo pós-commit');
    } catch (e: any) {
      expect(e.message).toContain('RECOVERY_REQUIRED');

      // 1. Validar existência do .pending e registrar IDs exatos
      expect(fs.existsSync(pPath)).toBe(true);
      const extractedIds = registerPendingAssignmentIds(pPath);
      expect(extractedIds.length).toBe(1);

      // 2. Confirma que a quantidade no banco bate com os IDs extraídos
      const count = await prisma.classStaffAssignment.count({ where: { id: { in: extractedIds } } });
      expect(count).toBe(extractedIds.length);

      // 3. Recibo definitivo ausente
      expect(fs.existsSync(rPath)).toBe(false);
    }
  });

  // 47. arquivo temporário é removido após falha
  it('47. arquivo temporário é removido após falha', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_tmp_fail_${Date.now()}.json`);

    await prisma.organizationMembership.update({ where: { id: currentMembershipId }, data: { status: 'INACTIVE' } });

    try {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    } catch (e) {}

    const files = fs.readdirSync(currentTestTmpDir);
    const tmpFiles = files.filter(f => f.includes('.tmp'));
    expect(tmpFiles.length).toBe(0);
  });

  // 48. dry-run não grava manifesto dentro do repositório
  it('48. dry-run não grava manifesto dentro do repositório', async () => {
    const repoMPath = path.resolve(__dirname, '../../../manifest_in_repo.json');
    expect(() => {
      runScript([`--manifest=${repoMPath}`]);
    }).toThrow(/Caminho do manifesto não pode ser dentro do repositório/);

    expect(fs.existsSync(repoMPath)).toBe(false);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(0);
  });

  // 49. active alterado para false bloqueia rollback
  it('49. active alterado para false bloqueia rollback', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_49_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const rHash = getReceiptHash(applyOut);
    const receiptData = parseReceipt(applyOut);
    const createdId = receiptData?.receipt.createdAssignments[0].id;

    await prisma.classStaffAssignment.update({ where: { id: createdId }, data: { active: false } });

    expect(() => {
      runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`]);
    }).toThrow(/ASSIGNMENT_CONFLICT: Assignment .* foi alterado ou não bate com o recibo/);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(1);
  });

  // 50. campo alterado e depois restaurado continua bloqueado pela divergência de updatedAt
  it('50. campo alterado e depois restaurado continua bloqueado pela divergência de updatedAt', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_50_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const rHash = getReceiptHash(applyOut);
    const receiptData = parseReceipt(applyOut);
    const createdId = receiptData?.receipt.createdAssignments[0].id;

    await prisma.classStaffAssignment.update({ where: { id: createdId }, data: { assignmentRole: 'AUXILIAR' } });
    await new Promise(r => setTimeout(r, 100));
    await prisma.classStaffAssignment.update({ where: { id: createdId }, data: { assignmentRole: 'PROFESSOR' } });

    expect(() => {
      runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`]);
    }).toThrow(/ASSIGNMENT_CONFLICT: Assignment .* foi alterado ou não bate com o recibo/);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(1);
  });

  // 51. conflito em um item entre vários impede a exclusão de todos
  it('51. conflito em um item entre vários impede a exclusão de todos', async () => {
    await createTestUser('PROFESSOR');

    const u2 = 'user-51-' + Date.now();
    const m2 = 'mem-51-' + Date.now();
    trackUser(u2);
    trackMembership(m2);

    await prisma.user.create({ data: { id: u2, name: 'U51', email: u2 + '@t.com', classId: classId, password: 'p' } });
    await prisma.organizationMembership.create({ data: { id: m2, userId: u2, organizationId: orgId, role: 'PROFESSOR', status: 'ACTIVE' } });

    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_51_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const rHash = getReceiptHash(applyOut);
    const receiptData = parseReceipt(applyOut);

    expect(receiptData?.receipt.createdAssignments.length).toBe(2);
    const id1 = receiptData!.receipt.createdAssignments[0].id;
    const id2 = receiptData!.receipt.createdAssignments[1].id;

    await prisma.classStaffAssignment.update({ where: { id: id1 }, data: { active: false } });

    expect(() => {
      runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`]);
    }).toThrow(/ASSIGNMENT_CONFLICT: Assignment .* foi alterado ou não bate com o recibo/);

    // Confirm atomic rollback block: BOTH assignments remain in database
    const remainingCount = await prisma.classStaffAssignment.count({ where: { id: { in: [id1, id2] } } });
    expect(remainingCount).toBe(2);
  });

  // 52. recibo sem active/createdAt/updatedAt é rejeitado
  it('52. recibo sem active/createdAt/updatedAt é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_52_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const receiptData = parseReceipt(applyOut);

    delete receiptData?.receipt.createdAssignments[0].active;
    const content = JSON.stringify(receiptData?.receipt, null, 2);
    fs.writeFileSync(rPath, content, 'utf8');
    const tamperedHash = crypto.createHash('sha256').update(content).digest('hex');

    expect(() => {
      runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${tamperedHash}`]);
    }).toThrow(/incompleto/);
  });

  // 53. rollback normal com fingerprint intacto continua funcionando
  it('53. rollback normal com fingerprint intacto continua funcionando', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_53_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const rHash = getReceiptHash(applyOut);

    runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`]);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(0);
  });

  // 54. falha ao criar .pending produz zero escritas
  it('54. falha ao criar .pending produz zero escritas', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();

    const rPath = getExternalPath(`receipt_54_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;
    fs.writeFileSync(pPath, '{}', 'utf8'); // Existing pending triggers failure

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/já existe/);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(0);
  });

  // 55. .pending existe antes da primeira escrita no banco
  it('55. .pending existe antes da primeira escrita no banco', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_55_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;

    try {
      runScript(
        ['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`],
        { S2_TEST_FAIL_AFTER_PENDING_BEFORE_TRANSACTION: '1' }
      );
      expect.fail('Deveria ter parado após a criação do .pending antes da transação');
    } catch (e: any) {
      expect(e.message).toContain('TEST_STOP_AFTER_PENDING_BEFORE_TRANSACTION');
    }

    // 1. Confirm .pending exists
    expect(fs.existsSync(pPath)).toBe(true);

    // 2. Register .pending IDs for cleanup/audit
    const extractedIds = registerPendingAssignmentIds(pPath);
    expect(extractedIds.length).toBe(1);

    // 3. Confirm ClassStaffAssignment count in DB is 0 (zero writes occurred)
    const count = await prisma.classStaffAssignment.count({ where: { id: { in: extractedIds } } });
    expect(count).toBe(0);
  });

  // 56. falha após commit preserva .pending e retorna RECOVERY_REQUIRED
  it('56. falha após commit preserva .pending e retorna RECOVERY_REQUIRED', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_56_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;

    try {
      runScript(
        ['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`],
        { S2_TEST_FAIL_AFTER_COMMIT: '1' }
      );
      expect.fail('Deveria ter falhado pós-commit');
    } catch (e: any) {
      expect(e.message).toContain('RECOVERY_REQUIRED');

      // 1. Validar existência do .pending e registrar IDs exatos
      expect(fs.existsSync(pPath)).toBe(true);
      const extractedIds = registerPendingAssignmentIds(pPath);
      expect(extractedIds.length).toBe(1);

      // 2. Confirma que a quantidade no banco bate com os IDs extraídos
      const count = await prisma.classStaffAssignment.count({ where: { id: { in: extractedIds } } });
      expect(count).toBe(extractedIds.length);

      // 3. Recibo definitivo ausente
      expect(fs.existsSync(rPath)).toBe(false);
    }
  });

  // 57. recuperação com todos os registros promove o recibo
  it('57. recuperação com todos os registros promove o recibo', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const targetRPath = getExternalPath(`receipt_57_${Date.now()}.json`);
    const targetPPath = `${targetRPath}.pending`;

    try {
      runScript(
        ['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${targetRPath}`],
        { S2_TEST_FAIL_AFTER_COMMIT: '1' }
      );
      expect.fail('Deveria ter falhado pós-commit');
    } catch (e: any) {
      expect(e.message).toContain('RECOVERY_REQUIRED');
    }

    // 1. .pending existe
    expect(fs.existsSync(targetPPath)).toBe(true);

    // 2. Recibo definitivo NÃO existe antes da recuperação
    expect(fs.existsSync(targetRPath)).toBe(false);

    // 3. IDs do pending registrados para auditoria/limpeza
    const extractedIds = registerPendingAssignmentIds(targetPPath);
    expect(extractedIds.length).toBe(1);

    const pContent = fs.readFileSync(targetPPath, 'utf8');
    const pHash = crypto.createHash('sha256').update(pContent, 'utf8').digest('hex');

    // 4. Recuperação termina com sucesso
    const recOut = runScript([`--recover-pending=${targetPPath}`, `--checksum=${pHash}`]);
    expect(recOut).toContain('Recuperação concluída com sucesso');
    expect(recOut).toContain('Recibo promovido para');

    // 5. Recibo definitivo existe
    expect(fs.existsSync(targetRPath)).toBe(true);

    // 6. .pending foi removido
    expect(fs.existsSync(targetPPath)).toBe(false);

    // 7. Fingerprint e IDs do recibo promovido coincidem
    const promotedContent = fs.readFileSync(targetRPath, 'utf8');
    const promotedReceipt = JSON.parse(promotedContent);
    expect(promotedReceipt.createdAssignments.length).toBe(1);
    expect(promotedReceipt.createdAssignments[0].id).toBe(extractedIds[0]);
  });

  // 58. recuperação com zero registros trata transação não aplicada
  it('58. recuperação com zero registros trata transação não aplicada', async () => {
    const targetPPath = getExternalPath(`pending_unapplied_${Date.now()}.json.pending`);
    const pendingJournal = {
      journalVersion: '1.0',
      status: 'PENDING',
      runId: 'run-58',
      sourceManifestChecksum: 'hash58',
      host: 'srv890.hstgr.io',
      dbName: 'u223033896_ebd_test',
      createdAt: new Date().toISOString(),
      createdAssignments: [
        {
          id: 'unapplied-csa-' + Date.now(),
          classId: classId,
          organizationId: orgId,
          organizationMembershipId: 'mem-58',
          assignmentRole: 'PROFESSOR',
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      alreadyAppliedAssignments: []
    };

    const pContent = JSON.stringify(pendingJournal, null, 2);
    fs.writeFileSync(targetPPath, pContent, 'utf8');
    const pHash = crypto.createHash('sha256').update(pContent, 'utf8').digest('hex');

    const recOut = runScript([`--recover-pending=${targetPPath}`, `--checksum=${pHash}`]);
    expect(recOut).toContain('Recuperação concluída: Confirmado que a transação não foi aplicada');
    expect(fs.existsSync(targetPPath)).toBe(false);
  });

  // 59. recuperação parcial retorna PENDING_CONFLICT
  it('59. recuperação parcial retorna PENDING_CONFLICT', async () => {
    await createTestUser('PROFESSOR');

    const u2 = 'user-59-' + Date.now();
    const m2 = 'mem-59-' + Date.now();
    trackUser(u2);
    trackMembership(m2);

    await prisma.user.create({ data: { id: u2, name: 'U59', email: u2 + '@t.com', classId: classId, password: 'p' } });
    await prisma.organizationMembership.create({ data: { id: m2, userId: u2, organizationId: orgId, role: 'PROFESSOR', status: 'ACTIVE' } });

    const { manifestPath, hash } = generateIsolatedManifest();
    const targetRPath = getExternalPath(`receipt_59_${Date.now()}.json`);
    const targetPPath = `${targetRPath}.pending`;

    try {
      runScript(
        ['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${targetRPath}`],
        { S2_TEST_FAIL_AFTER_COMMIT: '1' }
      );
    } catch (e) {}

    expect(fs.existsSync(targetPPath)).toBe(true);
    const extractedIds = registerPendingAssignmentIds(targetPPath);
    expect(extractedIds.length).toBe(2);

    const id1 = extractedIds[0];
    await prisma.classStaffAssignment.delete({ where: { id: id1 } });

    const pContent = fs.readFileSync(targetPPath, 'utf8');
    const pHash = crypto.createHash('sha256').update(pContent, 'utf8').digest('hex');

    expect(() => {
      runScript([`--recover-pending=${targetPPath}`, `--checksum=${pHash}`]);
    }).toThrow(/PENDING_CONFLICT/);
  });

  // 60. fingerprint divergente retorna PENDING_CONFLICT
  it('60. fingerprint divergente retorna PENDING_CONFLICT', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const targetRPath = getExternalPath(`receipt_60_${Date.now()}.json`);
    const targetPPath = `${targetRPath}.pending`;

    try {
      runScript(
        ['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${targetRPath}`],
        { S2_TEST_FAIL_AFTER_COMMIT: '1' }
      );
    } catch (e) {}

    expect(fs.existsSync(targetPPath)).toBe(true);
    const extractedIds = registerPendingAssignmentIds(targetPPath);
    expect(extractedIds.length).toBe(1);

    const assignmentId = extractedIds[0];
    await prisma.classStaffAssignment.update({ where: { id: assignmentId }, data: { assignmentRole: 'AUXILIAR' } });

    const pContent = fs.readFileSync(targetPPath, 'utf8');
    const pHash = crypto.createHash('sha256').update(pContent, 'utf8').digest('hex');

    expect(() => {
      runScript([`--recover-pending=${targetPPath}`, `--checksum=${pHash}`]);
    }).toThrow(/PENDING_CONFLICT/);
  });

  // 61. novo apply com pending existente é bloqueado
  it('61. novo apply com pending existente é bloqueado', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_61_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;

    fs.writeFileSync(pPath, '{}', 'utf8');

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/já existe/);
  });

  // 62. fluxo normal cria recibo e remove pending
  it('62. fluxo normal cria recibo e remove pending', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_62_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;

    runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);

    expect(fs.existsSync(rPath)).toBe(true);
    expect(fs.existsSync(pPath)).toBe(false);
  });

  // 63. --rollback rejeita arquivo pending
  it('63. --rollback rejeita arquivo pending', async () => {
    const pPath = getExternalPath(`receipt_63_${Date.now()}.json.pending`);
    fs.writeFileSync(pPath, '{}', 'utf8');

    expect(() => {
      runScript(['--rollback', `--receipt=${pPath}`, '--checksum=dummy']);
    }).toThrow(/O comando --rollback não aceita arquivos .pending/);
  });

  // 64. execução a partir de subpasta do repositório detecta raiz git e bloqueia recibo no repositório
  it('64. execução a partir de subpasta do repositório detecta raiz git e bloqueia recibo no repositório', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const subfolder = path.resolve(__dirname, '../../../src');
    const inRepoReceipt = path.join(subfolder, `in_repo_${Date.now()}.json`);

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${inRepoReceipt}`], {}, subfolder);
    }).toThrow(/Caminho do recibo não pode ser dentro do repositório/);
  });

  // 65. temporário exato .tmp impede apply e preserva o arquivo
  it('65. temporário exato .tmp impede apply e preserva o arquivo', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_65_${Date.now()}.json`);
    const tmpPath = `${rPath}.pending.tmp`;

    fs.writeFileSync(tmpPath, 'PRESERVE_ME', 'utf8');

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/já existe/);

    expect(fs.existsSync(tmpPath)).toBe(true);
    expect(fs.readFileSync(tmpPath, 'utf8')).toBe('PRESERVE_ME');
  });

  // 66. temporário com timestamp .tmp_12345 impede apply e preserva o arquivo
  it('66. temporário com timestamp .tmp_12345 impede apply e preserva o arquivo', async () => {
    await createTestUser('PROFESSOR');
    const { manifestPath, hash } = generateIsolatedManifest();
    const rPath = getExternalPath(`receipt_66_${Date.now()}.json`);
    const tmpPath = `${rPath}.pending.tmp_123456789`;

    fs.writeFileSync(tmpPath, 'PRESERVE_TIMESTAMP', 'utf8');

    expect(() => {
      runScript(['--apply', `--manifest=${manifestPath}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/já existe/);

    expect(fs.existsSync(tmpPath)).toBe(true);
    expect(fs.readFileSync(tmpPath, 'utf8')).toBe('PRESERVE_TIMESTAMP');
  });

  // 67. recuperação bloqueada por recibo definitivo existente
  it('67. recuperação bloqueada por recibo definitivo existente', async () => {
    const rPath = getExternalPath(`receipt_67_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;

    fs.writeFileSync(rPath, '{}', 'utf8');
    fs.writeFileSync(pPath, '{}', 'utf8');

    expect(() => {
      runScript([`--recover-pending=${pPath}`, '--checksum=dummy']);
    }).toThrow(/Arquivo de recibo definitivo já existe/);
  });

  // 68. recuperação bloqueada por temporário do recibo definitivo
  it('68. recuperação bloqueada por temporário do recibo definitivo', async () => {
    const rPath = getExternalPath(`receipt_68_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;
    const tmpRPath = `${rPath}.tmp_123`;

    fs.writeFileSync(tmpRPath, '{}', 'utf8');
    fs.writeFileSync(pPath, '{}', 'utf8');

    expect(() => {
      runScript([`--recover-pending=${pPath}`, '--checksum=dummy']);
    }).toThrow(/temporário/);
  });

  // 69. falha ao listar o diretório abortando de forma segura
  it('69. falha ao listar o diretório abortando de forma segura', async () => {
    const nonExistDir = getExternalPath('non_existent_sub_dir');
    const rPath = path.join(nonExistDir, 'receipt.json');

    expect(() => {
      runScript(['--apply', `--manifest=dummy`, '--checksum=dummy', `--receipt=${rPath}`]);
    }).toThrow();
  });
});
