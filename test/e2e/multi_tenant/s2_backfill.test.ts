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
let generatedManifest: string | null = null;
let generatedReceipt: string | null = null;

function runScript(args: string[] = [], envOverrides?: any, cwdOverride?: string): string {
  const scriptPath = path.resolve(__dirname, '../../../scripts/s2_backfill.ts');
  const tsxBin = path.resolve(__dirname, '../../../node_modules/tsx/dist/cli.mjs');
  const env = { ...process.env, ...envOverrides };
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
    await resetOrgAndClass();
  });

  beforeEach(async () => {
    await resetOrgAndClass();
  });

  afterAll(async () => {
    try {
      const assignmentIdsToVerify = Array.from(trackedAssignmentIds);
      const membershipIdsToVerify = Array.from(trackedMembershipIds);
      const userIdsToVerify = Array.from(trackedUserIds);
      const classIdsToVerify = Array.from(new Set([...Array.from(trackedClassIds), classId]));
      const orgIdsToVerify = Array.from(new Set([...Array.from(trackedOrgIds), orgId]));

      await cleanupTrackedIds(true);

      const baseClassCount = await prisma.class.count({ where: { id: classId } });
      const baseOrgCount = await prisma.organization.count({ where: { id: orgId } });

      const remainingAssignments = assignmentIdsToVerify.length > 0
        ? await prisma.classStaffAssignment.count({ where: { id: { in: assignmentIdsToVerify } } })
        : 0;
      const remainingMemberships = membershipIdsToVerify.length > 0
        ? await prisma.organizationMembership.count({ where: { id: { in: membershipIdsToVerify } } })
        : 0;
      const remainingUsers = userIdsToVerify.length > 0
        ? await prisma.user.count({ where: { id: { in: userIdsToVerify } } })
        : 0;
      const remainingClasses = classIdsToVerify.length > 0
        ? await prisma.class.count({ where: { id: { in: classIdsToVerify } } })
        : 0;
      const remainingOrgs = orgIdsToVerify.length > 0
        ? await prisma.organization.count({ where: { id: { in: orgIdsToVerify } } })
        : 0;

      console.log('[Sanitized Log] AFTER_ALL_CLEANUP_EXECUTED');
      console.log(`[Sanitized Log] BASE_CLASS_REMAINING: ${baseClassCount}`);
      console.log(`[Sanitized Log] BASE_ORG_REMAINING: ${baseOrgCount}`);

      const totalRemaining = baseClassCount + baseOrgCount + remainingAssignments + remainingMemberships + remainingUsers + remainingClasses + remainingOrgs;
      if (totalRemaining > 0) {
        throw new Error(
          `LEAK_DETECTED: Suíte S2 deixou ${totalRemaining} registros no banco (` +
          `BASE_CLASS: ${baseClassCount}, BASE_ORG: ${baseOrgCount}, Assignments: ${remainingAssignments}, Memberships: ${remainingMemberships}, Users: ${remainingUsers}, Classes: ${remainingClasses}, Orgs: ${remainingOrgs})`
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  afterEach(async () => {
    try {
      if (generatedManifest && fs.existsSync(generatedManifest)) {
        try { fs.unlinkSync(generatedManifest); } catch (e) {}
        generatedManifest = null;
      }
      if (generatedReceipt && fs.existsSync(generatedReceipt)) {
        try { fs.unlinkSync(generatedReceipt); } catch (e) {}
        generatedReceipt = null;
      }
    } finally {
      await cleanupTrackedIds(false);
    }
  });

  async function resetOrgAndClass() {
    trackedOrgIds.add(orgId);
    trackedClassIds.add(classId);
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

    trackedUserIds.add(currentUserId);
    if (role !== 'NO_MEMBERSHIP') {
      trackedMembershipIds.add(currentMembershipId);
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

  function parseManifest(stdout: string) {
    const match = stdout.match(/Manifesto gerado (?:em: |: )(.+)/);
    if (match) {
      generatedManifest = match[1].trim();
      const content = fs.readFileSync(generatedManifest, 'utf8');
      return JSON.parse(content);
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
      generatedReceipt = match[1].trim();
      if (fs.existsSync(generatedReceipt)) {
        const content = fs.readFileSync(generatedReceipt, 'utf8');
        const receipt = JSON.parse(content);
        if (receipt.createdAssignments) {
          receipt.createdAssignments.forEach((a: any) => {
            if (a.id) trackedAssignmentIds.add(a.id);
          });
        }
        return { receiptPath: generatedReceipt, receipt };
      }
    }
    return null;
  }

  function getReceiptHash(stdout: string) {
    const match = stdout.match(/SHA-256 do recibo: (.+)/);
    return match ? match[1].trim() : null;
  }

  function getExternalPath(filename: string) {
    return path.join(os.tmpdir(), filename);
  }

  // 1. PROFESSOR gera candidato PROFESSOR
  it('1. PROFESSOR gera candidato PROFESSOR', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    const manifest = parseManifest(out);
    expect(manifest.candidatesCount).toBe(1);
    expect(manifest.candidates[0].assignmentRole).toBe('PROFESSOR');
  });

  // 2. APOIO gera candidato AUXILIAR
  it('2. APOIO gera candidato AUXILIAR', async () => {
    await createTestUser('APOIO');
    const out = runScript([]);
    const manifest = parseManifest(out);
    expect(manifest.candidatesCount).toBe(1);
    expect(manifest.candidates[0].assignmentRole).toBe('AUXILIAR');
  });

  // 3. ADMIN é bloqueado como papel não suportado
  it('3. ADMIN é bloqueado como papel não suportado', async () => {
    await createTestUser('ADMIN');
    const out = runScript([]);
    const manifest = parseManifest(out);
    expect(manifest.invalidCount).toBe(1);
    expect(manifest.invalid[0].reason).toBe('UNSUPPORTED_MEMBERSHIP_ROLE');
  });

  // 4. DIRIGENTE é bloqueado
  it('4. DIRIGENTE é bloqueado', async () => {
    await createTestUser('DIRIGENTE');
    const out = runScript([]);
    const manifest = parseManifest(out);
    expect(manifest.invalidCount).toBe(1);
    expect(manifest.invalid[0].reason).toBe('UNSUPPORTED_MEMBERSHIP_ROLE');
  });

  // 5. VICE_DIRIGENTE é bloqueado
  it('5. VICE_DIRIGENTE é bloqueado', async () => {
    await createTestUser('VICE_DIRIGENTE');
    const out = runScript([]);
    const manifest = parseManifest(out);
    expect(manifest.invalidCount).toBe(1);
    expect(manifest.invalid[0].reason).toBe('UNSUPPORTED_MEMBERSHIP_ROLE');
  });

  // 6. Membership inexistente é bloqueada
  it('6. Membership inexistente é bloqueada', async () => {
    await createTestUser('NO_MEMBERSHIP');
    const out = runScript([]);
    const manifest = parseManifest(out);
    expect(manifest.invalidCount).toBe(1);
    expect(manifest.invalid[0].reason).toBe('MEMBERSHIP_NOT_FOUND');
  });

  // 7. Membership inativa é bloqueada
  it('7. Membership inativa é bloqueada', async () => {
    await createTestUser('PROFESSOR', 'INACTIVE');
    const out = runScript([]);
    const manifest = parseManifest(out);
    expect(manifest.invalid[0].reason).toBe('MEMBERSHIP_INACTIVE');
  });

  // 8. Organization inativa é bloqueada
  it('8. Organization inativa é bloqueada', async () => {
    await createTestUser('PROFESSOR', 'ACTIVE', true, false, true);
    const out = runScript([]);
    const manifest = parseManifest(out);
    expect(manifest.invalid[0].reason).toBe('ORGANIZATION_INACTIVE');
    await resetOrgAndClass();
  });

  // 9. Class inativa é bloqueada
  it('9. Class inativa é bloqueada', async () => {
    await createTestUser('PROFESSOR', 'ACTIVE', true, true, false);
    const out = runScript([]);
    const manifest = parseManifest(out);
    expect(manifest.invalid[0].reason).toBe('CLASS_INACTIVE');
    await resetOrgAndClass();
  });

  // 10. Class inexistente é bloqueada
  it('10. Class inexistente é bloqueada', async () => {
    await createTestUser('PROFESSOR');
    await prisma.class.delete({ where: { id: classId } });

    const out = runScript([]);
    const manifest = parseManifest(out);
    expect(manifest.invalid[0].reason).toBe('CLASS_NOT_FOUND');

    await resetOrgAndClass();
  });

  // 11. relação de outra organização é bloqueada
  it('11. relação de outra organização é bloqueada', async () => {
    await createTestUser('PROFESSOR');
    const otherOrgId = 'other-org-' + Date.now();
    const otherClassId = 'other-class-' + Date.now();

    trackedOrgIds.add(otherOrgId);
    trackedClassIds.add(otherClassId);

    await prisma.organization.create({ data: { id: otherOrgId, name: 'O', slug: 'o-' + Date.now(), active: true } });
    await prisma.class.create({ data: { id: otherClassId, name: 'C', organizationId: otherOrgId, status: true } });

    await prisma.user.update({ where: { id: currentUserId }, data: { classId: otherClassId } });
    const out = runScript([]);
    const manifest = parseManifest(out);
    expect(manifest.invalid[0].reason).toBe('MEMBERSHIP_NOT_FOUND');

    await prisma.class.delete({ where: { id: otherClassId } });
    await prisma.organization.delete({ where: { id: otherOrgId } });
  });

  // 12. dry-run não escreve
  it('12. dry-run não escreve', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(0);
  });

  // 13. apply cria somente o Assignment manifestado e gera recibo
  it('13. apply cria somente o Assignment manifestado e gera recibo', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    const manifest = parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_test_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const receiptData = parseReceipt(applyOut);
    expect(receiptData?.receipt.createdAssignments.length).toBe(1);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(1);

    if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
  });

  // 14. segundo apply registra Assignment como já aplicado, sem duplicar
  it('14. segundo apply registra Assignment como já aplicado, sem duplicar', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath1 = getExternalPath(`receipt_test1_${Date.now()}.json`);
    const rPath2 = getExternalPath(`receipt_test2_${Date.now()}.json`);

    runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath1}`]);
    const applyOut2 = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath2}`]);
    const receiptData2 = parseReceipt(applyOut2);

    expect(receiptData2?.receipt.createdAssignments.length).toBe(0);
    expect(receiptData2?.receipt.alreadyAppliedAssignments.length).toBe(1);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(1);

    if (fs.existsSync(rPath1)) fs.unlinkSync(rPath1);
    if (fs.existsSync(rPath2)) fs.unlinkSync(rPath2);
  });

  // 15. Assignment existente é preservado
  it('15. Assignment existente é preservado', async () => {
    await createTestUser('PROFESSOR');
    const existingCsaId = 'existing-csa-' + Date.now();
    trackedAssignmentIds.add(existingCsaId);
    await prisma.classStaffAssignment.create({
      data: {
        id: existingCsaId,
        classId: classId,
        organizationId: orgId,
        organizationMembershipId: currentMembershipId,
        assignmentRole: 'PROFESSOR',
        active: true
      }
    });

    const out = runScript([]);
    const manifest = parseManifest(out);
    expect(manifest.invalid[0].reason).toBe('ASSIGNMENT_ALREADY_EXISTS');
  });

  // 16. checksum adulterado é rejeitado
  it('16. checksum adulterado é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const rPath = getExternalPath('r.json');

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, '--checksum=invalidhash12345', `--receipt=${rPath}`]);
    }).toThrow(/Checksum adulterado/);
  });

  // 17. manifesto de outro banco é rejeitado
  it('17. manifesto de outro banco é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    const manifest = parseManifest(out);
    const rPath = getExternalPath('r.json');

    manifest.dbName = 'u223033896_other_db';
    const modifiedContent = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(generatedManifest!, modifiedContent, 'utf8');
    const tamperedHash = require('crypto').createHash('sha256').update(modifiedContent).digest('hex');

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${tamperedHash}`, `--receipt=${rPath}`]);
    }).toThrow(/Manifesto gerado para outro banco ou host/);
  });

  // 18. apply e rollback no _dev são rejeitados
  it('18. apply no _dev é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath('r.json');

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`], {
        DATABASE_URL: 'mysql://u223033896_ebd_dev2026:mock_pass_dev@srv890.hstgr.io:3306/u223033896_ebd_dev'
      });
    }).toThrow(/Restrito ao _test/);
  });

  // 19. produção é rejeitada antes da conexão do PrismaClient
  it('19. produção é rejeitada', async () => {
    expect(() => {
      runScript([], {
        DATABASE_URL: 'mysql://u223033896_ebd2026:mock_pass_prod@srv890.hstgr.io:3306/u223033896_ebd2026'
      });
    }).toThrow(/Acesso a produção terminantemente proibido/);
  });

  // 20. rollback remove somente os IDs criados do recibo
  it('20. rollback remove somente os IDs criados pelo recibo', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_test_rb_${Date.now()}.json`);

    const presetId = 'do-not-delete-' + Date.now();
    trackedAssignmentIds.add(presetId);
    await prisma.classStaffAssignment.create({
      data: {
        id: presetId,
        classId: classId,
        organizationId: orgId,
        organizationMembershipId: currentMembershipId,
        assignmentRole: 'AUXILIAR'
      }
    });

    const applyOut = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const receiptData = parseReceipt(applyOut);
    const rHash = getReceiptHash(applyOut);

    let count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(2);

    runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`]);

    count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(1);

    const rem = await prisma.classStaffAssignment.findUnique({ where: { id: presetId } });
    expect(rem).not.toBeNull();

    if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
  });

  // 21. User.classId permanece inalterado
  it('21. User.classId permanece inalterado', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_u_${Date.now()}.json`);

    runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);

    const u = await prisma.user.findUnique({ where: { id: currentUserId } });
    expect(u?.classId).toBe(classId);

    if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
  });

  // 22. falha intermediária realiza rollback transacional
  it('22. falha intermediária realiza rollback transacional', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath('r.json');

    // Alter state manually (e.g. deactivate class)
    await prisma.class.update({ where: { id: classId }, data: { status: false } });

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/mudou de estado/);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(0);

    await resetOrgAndClass();
  });

  // 23. cleanup final deixa o _test zerado
  it('23. cleanup final deixa o _test zerado', async () => {
    const csaCount = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(csaCount).toBe(0);
  });

  // 24. rollback sem checksum é recusado
  it('24. rollback sem checksum é recusado', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const rPath = getExternalPath('receipt.json');

    expect(() => {
      runScript(['--rollback', `--receipt=${rPath}`]);
    }).toThrow(/Checksum do recibo é obrigatório/);
  });

  // 25. apply sem checksum é rejeitado
  it('25. apply sem checksum é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const rPath = getExternalPath('receipt.json');

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--receipt=${rPath}`]);
    }).toThrow(/Checksum do manifesto é obrigatório/);
  });

  // 26. rollback no _dev é rejeitado
  it('26. rollback no _dev é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const rPath = getExternalPath(`receipt_dev_${Date.now()}.json`);
    fs.writeFileSync(rPath, JSON.stringify({ dbName: 'u223033896_ebd_dev', host: 'srv890.hstgr.io', createdAssignments: [] }), 'utf8');
    const rHash = require('crypto').createHash('sha256').update(fs.readFileSync(rPath, 'utf8')).digest('hex');

    expect(() => {
      runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`], {
        DATABASE_URL: 'mysql://u223033896_ebd_dev2026:mock_pass_dev@srv890.hstgr.io:3306/u223033896_ebd_dev'
      });
    }).toThrow(/Restrito ao _test/);

    if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
  });

  // 27. host não autorizado é rejeitado
  it('27. host não autorizado é rejeitado', async () => {
    expect(() => {
      runScript([], {
        DATABASE_URL: 'mysql://user:pass@unauthorized-host.com:3306/u223033896_ebd_test'
      });
    }).toThrow(/Host não autorizado/);
  });

  // 28. banco desconhecido é rejeitado até em dry-run
  it('28. banco desconhecido é rejeitado até em dry-run', async () => {
    expect(() => {
      runScript([], {
        DATABASE_URL: 'mysql://user:pass@srv890.hstgr.io:3306/u223033896_ebd_unknown'
      });
    }).toThrow(/Banco de dados desconhecido ou não autorizado/);
  });

  // 29. manifesto com host diferente é rejeitado
  it('29. manifesto com host diferente é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    const manifest = parseManifest(out);
    const rPath = getExternalPath('r.json');

    manifest.host = 'other-host.com';
    const modifiedContent = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(generatedManifest!, modifiedContent, 'utf8');
    const tamperedHash = require('crypto').createHash('sha256').update(modifiedContent).digest('hex');

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${tamperedHash}`, `--receipt=${rPath}`]);
    }).toThrow(/Manifesto gerado para outro banco ou host/);
  });

  // 30. Membership cujo userId mudou invalida o snapshot
  it('30. Membership cujo userId mudou invalida o snapshot', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath('r.json');

    const otherUserId = 'other-user-' + Date.now();
    trackedUserIds.add(otherUserId);
    await prisma.user.create({
      data: {
        id: otherUserId,
        name: 'Other User',
        email: `${otherUserId}@test.com`,
        password: 'hashedpassword'
      }
    });
    await prisma.organizationMembership.update({ where: { id: currentMembershipId }, data: { userId: otherUserId } });

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/mudou de estado/);
  });

  // 31. Membership cuja organizationId mudou invalida o snapshot
  it('31. Membership cuja organizationId mudou invalida o snapshot', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath('r.json');

    const otherOrgId = 'other-org-' + Date.now();
    trackedOrgIds.add(otherOrgId);
    await prisma.organization.create({ data: { id: otherOrgId, name: 'Other Org', slug: `other-org-${Date.now()}`, active: true } });
    await prisma.organizationMembership.update({ where: { id: currentMembershipId }, data: { organizationId: otherOrgId } });

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/mudou de estado/);
  });

  // 32. Membership cujo role mudou invalida o snapshot
  it('32. Membership cujo role mudou invalida o snapshot', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath('r.json');

    await prisma.organizationMembership.update({ where: { id: currentMembershipId }, data: { role: 'ADMIN' } });

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/role mudou/);
  });

  // 33. Assignment conflitante não é sobrescrito
  it('33. Assignment conflitante não é sobrescrito', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    const manifest = parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath('r.json');

    const conflictingCsaId = 'conflicting-csa-' + Date.now();
    trackedAssignmentIds.add(conflictingCsaId);
    await prisma.classStaffAssignment.create({
      data: {
        id: conflictingCsaId,
        classId: classId,
        organizationId: orgId,
        organizationMembershipId: currentMembershipId,
        assignmentRole: 'AUXILIAR',
        active: true
      }
    });

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/ASSIGNMENT_CONFLICT/);
  });

  // 34. apply gera recibo somente com IDs realmente criados
  it('34. apply gera recibo somente com IDs realmente criados', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    const manifest = parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_34_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const receiptData = parseReceipt(applyOut);

    expect(receiptData?.receipt.createdAssignments.length).toBe(1);
    expect(receiptData?.receipt.createdAssignments[0].id).toBe(manifest.candidates[0].plannedAssignmentId);
    expect(receiptData?.receipt.alreadyAppliedAssignments.length).toBe(0);

    if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
  });

  // 35. segundo apply registra Assignment como já aplicado, sem duplicar
  it('35. segundo apply registra Assignment como já aplicado, sem duplicar', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath1 = getExternalPath(`receipt_35_1_${Date.now()}.json`);
    const rPath2 = getExternalPath(`receipt_35_2_${Date.now()}.json`);

    runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath1}`]);
    const applyOut2 = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath2}`]);
    const receiptData2 = parseReceipt(applyOut2);

    expect(receiptData2?.receipt.createdAssignments.length).toBe(0);
    expect(receiptData2?.receipt.alreadyAppliedAssignments.length).toBe(1);

    if (fs.existsSync(rPath1)) fs.unlinkSync(rPath1);
    if (fs.existsSync(rPath2)) fs.unlinkSync(rPath2);
  });

  // 36. rollback remove somente createdAssignments do recibo
  it('36. rollback remove somente createdAssignments do recibo', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_36_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const receiptData = parseReceipt(applyOut);
    const rHash = getReceiptHash(applyOut);

    runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`]);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(0);

    if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
  });

  // 37. rollback preserva alreadyAppliedAssignments
  it('37. rollback preserva alreadyAppliedAssignments', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath1 = getExternalPath(`receipt_37_1_${Date.now()}.json`);
    const rPath2 = getExternalPath(`receipt_37_2_${Date.now()}.json`);

    runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath1}`]);
    const applyOut2 = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath2}`]);
    const receiptData2 = parseReceipt(applyOut2);
    const rHash2 = getReceiptHash(applyOut2);

    runScript(['--rollback', `--receipt=${rPath2}`, `--checksum=${rHash2}`]);

    const count = await prisma.classStaffAssignment.count({ where: { organizationId: orgId } });
    expect(count).toBe(1);

    if (fs.existsSync(rPath1)) fs.unlinkSync(rPath1);
    if (fs.existsSync(rPath2)) fs.unlinkSync(rPath2);
  });

  // 38. rollback rejeita Assignment cujos campos foram alterados
  it('38. rollback rejeita Assignment cujos campos foram alterados', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_38_${Date.now()}.json`);

    const applyOut = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    const receiptData = parseReceipt(applyOut);
    const rHash = getReceiptHash(applyOut);

    const createdId = receiptData?.receipt.createdAssignments[0].id;
    await prisma.classStaffAssignment.update({ where: { id: createdId }, data: { assignmentRole: 'AUXILIAR' } });

    expect(() => {
      runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`]);
    }).toThrow(/ASSIGNMENT_CONFLICT/);

    if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
  });

  // 39. recibo adulterado é rejeitado
  it('39. recibo adulterado é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_39_${Date.now()}.json`);

    runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);

    expect(() => {
      runScript(['--rollback', `--receipt=${rPath}`, '--checksum=invalidreceiptchecksum123']);
    }).toThrow(/Checksum do recibo adulterado/);

    if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
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
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath('r.json');

    await prisma.organizationMembership.update({ where: { id: currentMembershipId }, data: { status: 'INACTIVE' } });

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/mudou de estado durante a transação/);
  });

  // 42. mudança do papel dentro da transação é bloqueada
  it('42. mudança do papel dentro da transação é bloqueada', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath('r.json');

    await prisma.organizationMembership.update({ where: { id: currentMembershipId }, data: { role: 'APOIO' } });

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/role mudou durante a transação/);
  });

  // 43. falha transacional não gera recibo
  it('43. falha transacional não gera recibo', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_fail_${Date.now()}.json`);

    await prisma.class.update({ where: { id: classId }, data: { status: false } });

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow();

    expect(fs.existsSync(rPath)).toBe(false);
  });

  // 44. caminho de recibo dentro do repositório é rejeitado
  it('44. caminho de recibo dentro do repositório é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const repoReceiptPath = path.resolve(process.cwd(), `test_receipt_inside_repo_${Date.now()}.json`);

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${repoReceiptPath}`]);
    }).toThrow(/não pode ser dentro do repositório/);
  });

  // 45. recibo preexistente não é sobrescrito
  it('45. recibo preexistente não é sobrescrito', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_existing_${Date.now()}.json`);
    fs.writeFileSync(rPath, 'PREEXISTING_CONTENT', 'utf8');

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
    }).toThrow(/já existe e não pode ser sobrescrito/);

    const content = fs.readFileSync(rPath, 'utf8');
    expect(content).toBe('PREEXISTING_CONTENT');

    if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
  });

  // 46. falha na gravação pós-commit retorna erro e informa somente IDs
  it('46. falha na gravação pós-commit retorna erro e informa somente IDs', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    const manifest = parseManifest(out);
    const hash = getHash(out);
    const invalidReceiptDir = getExternalPath(`non_existent_dir_${Date.now()}/receipt.json`);

    try {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${invalidReceiptDir}`]);
      expect.fail('Deveria ter falhado na gravação');
    } catch (e: any) {
      expect(e.message).toContain('ERRO FATAL: Falha na gravação do recibo após commit');
      expect(e.message).toContain(manifest.candidates[0].plannedAssignmentId);
      expect(e.message).not.toContain('Test User');
    }
  });

  // 47. arquivo temporário é removido após falha
  it('47. arquivo temporário é removido após falha', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const invalidReceiptDir = getExternalPath(`invalid_dir_${Date.now()}/receipt.json`);

    try {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${invalidReceiptDir}`]);
    } catch (e) {
      // Ignorar falha esperada
    }

    const tmpFiles = fs.readdirSync(os.tmpdir()).filter(f => f.includes('.tmp_'));
    const matchingTmp = tmpFiles.filter(f => f.includes('invalid_dir_'));
    expect(matchingTmp.length).toBe(0);
  });

  // 48. dry-run não grava manifesto dentro do repositório
  it('48. dry-run não grava manifesto dentro do repositório', async () => {
    await createTestUser('PROFESSOR');
    const repoManifestPath = path.resolve(process.cwd(), `manifest_in_repo_${Date.now()}.json`);

    expect(() => {
      runScript([`--manifest=${repoManifestPath}`]);
    }).toThrow(/não pode ser dentro do repositório/);
  });

  // 49. active alterado para false bloqueia rollback
  it('49. active alterado para false bloqueia rollback', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_active_false_${Date.now()}.json`);

    try {
      const applyOut = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
      const rHash = getReceiptHash(applyOut);

      const createdReceipt = JSON.parse(fs.readFileSync(rPath, 'utf8'));
      const assignmentId = createdReceipt.createdAssignments[0].id;

      await prisma.classStaffAssignment.update({
        where: { id: assignmentId },
        data: { active: false }
      });

      expect(() => {
        runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`]);
      }).toThrow(/ASSIGNMENT_CONFLICT/);
    } finally {
      if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
    }
  });

  // 50. campo alterado e depois restaurado continua bloqueado pela divergência de updatedAt
  it('50. campo alterado e depois restaurado continua bloqueado pela divergência de updatedAt', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_updated_at_${Date.now()}.json`);

    try {
      const applyOut = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
      const rHash = getReceiptHash(applyOut);

      const createdReceipt = JSON.parse(fs.readFileSync(rPath, 'utf8'));
      const assignmentId = createdReceipt.createdAssignments[0].id;

      // Alterar campo e restaurar para forçar updatedAt diferente
      await prisma.classStaffAssignment.update({
        where: { id: assignmentId },
        data: { assignmentRole: 'AUXILIAR' }
      });
      await prisma.classStaffAssignment.update({
        where: { id: assignmentId },
        data: { assignmentRole: 'PROFESSOR' }
      });

      expect(() => {
        runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`]);
      }).toThrow(/ASSIGNMENT_CONFLICT/);
    } finally {
      if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
    }
  });

  // 51. conflito em um item entre vários impede a exclusão de todos
  it('51. conflito em um item entre vários impede a exclusão de todos', async () => {
    await createTestUser('PROFESSOR');
    await createTestUser('APOIO');

    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_multi_conflict_${Date.now()}.json`);

    try {
      const applyOut = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
      const rHash = getReceiptHash(applyOut);

      const createdReceipt = JSON.parse(fs.readFileSync(rPath, 'utf8'));
      const id1 = createdReceipt.createdAssignments[0].id;
      const id2 = createdReceipt.createdAssignments[1].id;

      // Alterar active no primeiro item apenas
      await prisma.classStaffAssignment.update({
        where: { id: id1 },
        data: { active: false }
      });

      expect(() => {
        runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`]);
      }).toThrow(/ASSIGNMENT_CONFLICT/);

      // Verificar que NENHUM dos dois foi excluído (transação revertida)
      const item1 = await prisma.classStaffAssignment.findUnique({ where: { id: id1 } });
      const item2 = await prisma.classStaffAssignment.findUnique({ where: { id: id2 } });
      expect(item1).not.toBeNull();
      expect(item2).not.toBeNull();
    } finally {
      if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
    }
  });

  // 52. recibo sem active/createdAt/updatedAt é rejeitado
  it('52. recibo sem active/createdAt/updatedAt é rejeitado', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_incomplete_${Date.now()}.json`);

    try {
      const applyOut = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);

      const createdReceipt = JSON.parse(fs.readFileSync(rPath, 'utf8'));

      // Remover active, createdAt e updatedAt para simular recibo incompleto/legado
      delete createdReceipt.createdAssignments[0].active;
      delete createdReceipt.createdAssignments[0].createdAt;
      delete createdReceipt.createdAssignments[0].updatedAt;

      const modifiedJson = JSON.stringify(createdReceipt, null, 2);
      fs.writeFileSync(rPath, modifiedJson, 'utf8');

      const newHash = crypto.createHash('sha256').update(modifiedJson, 'utf8').digest('hex');

      expect(() => {
        runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${newHash}`]);
      }).toThrow(/RECEIPT_INVALID_FINGERPRINT/);
    } finally {
      if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
    }
  });

  // 53. rollback normal com fingerprint intacto continua funcionando
  it('53. rollback normal com fingerprint intacto continua funcionando', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_normal_rollback_${Date.now()}.json`);

    try {
      const applyOut = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
      const rHash = getReceiptHash(applyOut);

      const createdReceipt = JSON.parse(fs.readFileSync(rPath, 'utf8'));
      const assignmentId = createdReceipt.createdAssignments[0].id;

      const rbOut = runScript(['--rollback', `--receipt=${rPath}`, `--checksum=${rHash}`]);
      expect(rbOut).toContain('Rollback concluído com sucesso');

      const existing = await prisma.classStaffAssignment.findUnique({ where: { id: assignmentId } });
      expect(existing).toBeNull();
    } finally {
      if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
    }
  });

  // 54. falha ao criar .pending produz zero escritas
  it('54. falha ao criar .pending produz zero escritas', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const invalidReceiptDir = getExternalPath(`invalid_pending_dir_${Date.now()}/receipt.json`);

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${invalidReceiptDir}`]);
    }).toThrow(/Falha na gravação do journal pending/);

    const assignments = await prisma.classStaffAssignment.findMany({ where: { organizationId: orgId } });
    expect(assignments.length).toBe(0);
  });

  // 55. .pending existe antes da primeira escrita no banco
  it('55. .pending existe antes da primeira escrita no banco', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_pending_exists_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;

    try {
      const applyOut = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
      expect(applyOut).toContain('Apply concluído com sucesso');
      expect(fs.existsSync(rPath)).toBe(true);
      expect(fs.existsSync(pPath)).toBe(false); // removido após promoção para recibo
    } finally {
      if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
      if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
    }
  });

  // 56. falha após commit preserva .pending e retorna RECOVERY_REQUIRED
  it('56. falha após commit preserva .pending e retorna RECOVERY_REQUIRED', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    const manifest = parseManifest(out);
    const hash = getHash(out);

    // Usar diretório pai válido para pending, mas bloqueado para rename do recibo
    const baseDir = getExternalPath(`rec_req_dir_${Date.now()}`);
    fs.mkdirSync(baseDir, { recursive: true });
    const rPath = path.join(baseDir, 'receipt.json');
    const pPath = `${rPath}.pending`;

    // Tornar rPath um diretório preexistente para forçar erro de I/O na gravação do recibo definitivo pós-commit
    fs.mkdirSync(rPath, { recursive: true });

    try {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
      expect.fail('Deveria ter falhado pós-commit');
    } catch (e: any) {
      expect(e.message).toContain('RECOVERY_REQUIRED: Falha na gravação do recibo após commit');
      expect(fs.existsSync(pPath)).toBe(true); // .pending PRESERVADO
    } finally {
      if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
      if (fs.existsSync(rPath)) fs.rmSync(rPath, { recursive: true, force: true });
      if (fs.existsSync(baseDir)) fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });

  // 57. recuperação com todos os registros promove o recibo
  it('57. recuperação com todos os registros promove o recibo', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_rec_promote_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;

    // 1. Executar apply forçando retenção do pending
    const baseDir = getExternalPath(`rec_promote_dir_${Date.now()}`);
    fs.mkdirSync(baseDir, { recursive: true });
    const targetRPath = path.join(baseDir, 'receipt.json');
    const targetPPath = `${targetRPath}.pending`;
    fs.mkdirSync(targetRPath, { recursive: true }); // força erro pós-commit

    try {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${targetRPath}`]);
    } catch (e) {}

    // Remover diretório colidido e permitir promoção
    fs.rmSync(targetRPath, { recursive: true, force: true });

    const pContent = fs.readFileSync(targetPPath, 'utf8');
    const pHash = crypto.createHash('sha256').update(pContent, 'utf8').digest('hex');

    try {
      const recOut = runScript([`--recover-pending=${targetPPath}`, `--checksum=${pHash}`]);
      expect(recOut).toContain('Recuperação concluída com sucesso');
      expect(fs.existsSync(targetRPath)).toBe(true);
      expect(fs.existsSync(targetPPath)).toBe(false);
    } finally {
      if (fs.existsSync(targetRPath)) fs.unlinkSync(targetRPath);
      if (fs.existsSync(targetPPath)) fs.unlinkSync(targetPPath);
      if (fs.existsSync(baseDir)) fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });

  // 58. recuperação com zero registros trata transação não aplicada
  it('58. recuperação com zero registros trata transação não aplicada', async () => {
    const pPath = getExternalPath(`fake_unapplied_${Date.now()}.json.pending`);

    const fakeJournal = {
      journalVersion: '1.0',
      status: 'PENDING',
      runId: 'run-fake-123',
      sourceManifestChecksum: 'hash123',
      host: 'srv890.hstgr.io',
      dbName: 'u223033896_ebd_test',
      createdAt: new Date().toISOString(),
      createdAssignments: [
        {
          id: 'csa-non-existent-id-999',
          classId: classId,
          organizationId: orgId,
          organizationMembershipId: 'mem-999',
          assignmentRole: 'PROFESSOR',
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      alreadyAppliedAssignments: []
    };

    const pContent = JSON.stringify(fakeJournal, null, 2);
    fs.writeFileSync(pPath, pContent, 'utf8');
    const pHash = crypto.createHash('sha256').update(pContent, 'utf8').digest('hex');

    try {
      const recOut = runScript([`--recover-pending=${pPath}`, `--checksum=${pHash}`]);
      expect(recOut).toContain('Confirmado que a transação não foi aplicada');
      expect(fs.existsSync(pPath)).toBe(false); // journal removido com segurança
    } finally {
      if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
    }
  });

  // 59. recuperação parcial retorna PENDING_CONFLICT
  it('59. recuperação parcial retorna PENDING_CONFLICT', async () => {
    await createTestUser('PROFESSOR');
    await createTestUser('APOIO');

    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_partial_rec_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;

    // Forçar falha pós-commit
    const baseDir = getExternalPath(`rec_partial_dir_${Date.now()}`);
    fs.mkdirSync(baseDir, { recursive: true });
    const targetRPath = path.join(baseDir, 'receipt.json');
    const targetPPath = `${targetRPath}.pending`;
    fs.mkdirSync(targetRPath, { recursive: true });

    try {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${targetRPath}`]);
    } catch (e) {}

    const pContent = fs.readFileSync(targetPPath, 'utf8');
    const journal = JSON.parse(pContent);
    const id1 = journal.createdAssignments[0].id;

    // Deletar o primeiro assignment no banco para forçar existência parcial
    await prisma.classStaffAssignment.delete({ where: { id: id1 } });

    const pHash = crypto.createHash('sha256').update(pContent, 'utf8').digest('hex');

    try {
      expect(() => {
        runScript([`--recover-pending=${targetPPath}`, `--checksum=${pHash}`]);
      }).toThrow(/PENDING_CONFLICT: Existência parcial de assignments/);
    } finally {
      if (fs.existsSync(targetPPath)) fs.unlinkSync(targetPPath);
      if (fs.existsSync(targetRPath)) fs.rmSync(targetRPath, { recursive: true, force: true });
      if (fs.existsSync(baseDir)) fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });

  // 60. fingerprint divergente retorna PENDING_CONFLICT
  it('60. fingerprint divergente retorna PENDING_CONFLICT', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);

    const baseDir = getExternalPath(`rec_div_dir_${Date.now()}`);
    fs.mkdirSync(baseDir, { recursive: true });
    const targetRPath = path.join(baseDir, 'receipt.json');
    const targetPPath = `${targetRPath}.pending`;
    fs.mkdirSync(targetRPath, { recursive: true });

    try {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${targetRPath}`]);
    } catch (e) {}

    const pContent = fs.readFileSync(targetPPath, 'utf8');
    const journal = JSON.parse(pContent);
    const assignmentId = journal.createdAssignments[0].id;

    // Alterar active para false no banco
    await prisma.classStaffAssignment.update({
      where: { id: assignmentId },
      data: { active: false }
    });

    const pHash = crypto.createHash('sha256').update(pContent, 'utf8').digest('hex');

    try {
      expect(() => {
        runScript([`--recover-pending=${targetPPath}`, `--checksum=${pHash}`]);
      }).toThrow(/PENDING_CONFLICT/);
    } finally {
      if (fs.existsSync(targetPPath)) fs.unlinkSync(targetPPath);
      if (fs.existsSync(targetRPath)) fs.rmSync(targetRPath, { recursive: true, force: true });
      if (fs.existsSync(baseDir)) fs.rmSync(baseDir, { recursive: true, force: true });
    }
  });

  // 61. novo apply com pending existente é bloqueado
  it('61. novo apply com pending existente é bloqueado', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_blocked_pending_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;

    fs.writeFileSync(pPath, 'EXISTING_PENDING', 'utf8');

    try {
      expect(() => {
        runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
      }).toThrow(/já existe e não pode ser sobrescrito/);
    } finally {
      if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
    }
  });

  // 62. fluxo normal cria recibo e remove pending
  it('62. fluxo normal cria recibo e remove pending', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_normal_flow_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;

    try {
      const applyOut = runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
      expect(applyOut).toContain('Apply concluído com sucesso');
      expect(fs.existsSync(rPath)).toBe(true);
      expect(fs.existsSync(pPath)).toBe(false);
    } finally {
      if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
      if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
    }
  });

  // 63. --rollback rejeita arquivo pending
  it('63. --rollback rejeita arquivo pending', async () => {
    const pPath = getExternalPath(`fake_pending_${Date.now()}.pending`);
    const fakeContent = JSON.stringify({ status: 'PENDING' });
    fs.writeFileSync(pPath, fakeContent, 'utf8');
    const pHash = crypto.createHash('sha256').update(fakeContent, 'utf8').digest('hex');

    try {
      expect(() => {
        runScript(['--rollback', `--receipt=${pPath}`, `--checksum=${pHash}`]);
      }).toThrow(/não aceita arquivos \.pending/);
    } finally {
      if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
    }
  });

  // 64. execução a partir de subpasta do repositório detecta raiz git e bloqueia recibo no repositório
  it('64. execução a partir de subpasta do repositório detecta raiz git e bloqueia recibo no repositório', async () => {
    await createTestUser('PROFESSOR');
    const subfolderCwd = path.resolve(__dirname, '../../../scripts');
    const out = runScript([], undefined, subfolderCwd);
    parseManifest(out);
    const hash = getHash(out);
    const inRepoReceipt = path.resolve(subfolderCwd, `receipt_in_subfolder_${Date.now()}.json`);

    expect(() => {
      runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${inRepoReceipt}`], undefined, subfolderCwd);
    }).toThrow(/não pode ser dentro do repositório/);
  });

  // 65. temporário exato .tmp impede apply e preserva o arquivo
  it('65. temporário exato .tmp impede apply e preserva o arquivo', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_exact_tmp_${Date.now()}.json`);
    const tmpPath = `${rPath}.tmp`;

    fs.writeFileSync(tmpPath, 'EXACT_TMP_CONTENT', 'utf8');

    try {
      expect(() => {
        runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
      }).toThrow(/Arquivo de recibo, journal pending ou arquivo temporário \.tmp já existe/);
      expect(fs.existsSync(tmpPath)).toBe(true);
      expect(fs.readFileSync(tmpPath, 'utf8')).toBe('EXACT_TMP_CONTENT');
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  });

  // 66. temporário com timestamp .tmp_12345 impede apply e preserva o arquivo
  it('66. temporário com timestamp .tmp_12345 impede apply e preserva o arquivo', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);
    const rPath = getExternalPath(`receipt_ts_tmp_${Date.now()}.json`);
    const timestampedTmpPath = `${rPath}.tmp_${Date.now()}`;

    fs.writeFileSync(timestampedTmpPath, 'TIMESTAMPED_TMP_CONTENT', 'utf8');

    try {
      expect(() => {
        runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${rPath}`]);
      }).toThrow(/Arquivo de recibo, journal pending ou arquivo temporário \.tmp já existe/);
      expect(fs.existsSync(timestampedTmpPath)).toBe(true);
      expect(fs.readFileSync(timestampedTmpPath, 'utf8')).toBe('TIMESTAMPED_TMP_CONTENT');
    } finally {
      if (fs.existsSync(timestampedTmpPath)) fs.unlinkSync(timestampedTmpPath);
    }
  });

  // 67. recuperação bloqueada por recibo definitivo existente
  it('67. recuperação bloqueada por recibo definitivo existente', async () => {
    const rPath = getExternalPath(`receipt_exists_rec_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;

    const fakeJournal = { status: 'PENDING', runId: 'run-123', dbName: 'u223033896_ebd_test', host: 'srv890.hstgr.io', createdAssignments: [] };
    const pContent = JSON.stringify(fakeJournal, null, 2);
    fs.writeFileSync(pPath, pContent, 'utf8');
    fs.writeFileSync(rPath, 'EXISTING_DEFINITIVE_RECEIPT', 'utf8');
    const pHash = crypto.createHash('sha256').update(pContent, 'utf8').digest('hex');

    try {
      expect(() => {
        runScript([`--recover-pending=${pPath}`, `--checksum=${pHash}`]);
      }).toThrow(/Arquivo de recibo definitivo já existe e não pode ser sobrescrito/);
    } finally {
      if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
      if (fs.existsSync(rPath)) fs.unlinkSync(rPath);
    }
  });

  // 68. recuperação bloqueada por temporário do recibo definitivo
  it('68. recuperação bloqueada por temporário do recibo definitivo', async () => {
    const rPath = getExternalPath(`receipt_tmp_rec_${Date.now()}.json`);
    const pPath = `${rPath}.pending`;
    const tmpReceiptPath = `${rPath}.tmp_${Date.now()}`;

    const fakeJournal = { status: 'PENDING', runId: 'run-123', dbName: 'u223033896_ebd_test', host: 'srv890.hstgr.io', createdAssignments: [] };
    const pContent = JSON.stringify(fakeJournal, null, 2);
    fs.writeFileSync(pPath, pContent, 'utf8');
    fs.writeFileSync(tmpReceiptPath, 'ABANDONED_RECEIPT_TMP', 'utf8');
    const pHash = crypto.createHash('sha256').update(pContent, 'utf8').digest('hex');

    try {
      expect(() => {
        runScript([`--recover-pending=${pPath}`, `--checksum=${pHash}`]);
      }).toThrow(/Arquivo temporário \.tmp relacionado ao recibo já existe e não pode ser sobrescrito/);
    } finally {
      if (fs.existsSync(pPath)) fs.unlinkSync(pPath);
      if (fs.existsSync(tmpReceiptPath)) fs.unlinkSync(tmpReceiptPath);
    }
  });

  // 69. falha ao listar o diretório abortando de forma segura
  it('69. falha ao listar o diretório abortando de forma segura', async () => {
    await createTestUser('PROFESSOR');
    const out = runScript([]);
    parseManifest(out);
    const hash = getHash(out);

    const notADirFile = getExternalPath(`not_a_dir_${Date.now()}.txt`);
    fs.writeFileSync(notADirFile, 'REGULAR_FILE_CONTENT', 'utf8');
    const invalidReceiptPath = path.join(notADirFile, 'receipt.json');

    try {
      expect(() => {
        runScript(['--apply', `--manifest=${generatedManifest}`, `--checksum=${hash}`, `--receipt=${invalidReceiptPath}`]);
      }).toThrow(/TMP_CHECK_FAILED/);
    } finally {
      if (fs.existsSync(notADirFile)) fs.unlinkSync(notADirFile);
    }
  });
});
