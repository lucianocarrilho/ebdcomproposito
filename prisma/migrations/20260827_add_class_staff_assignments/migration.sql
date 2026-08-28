-- CreateTable
CREATE TABLE `class_staff_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `classId` VARCHAR(191) NOT NULL,
    `organizationMembershipId` VARCHAR(191) NOT NULL,
    `assignmentRole` ENUM('PROFESSOR', 'AUXILIAR') NOT NULL DEFAULT 'PROFESSOR',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `csa_org_active_idx`(`organizationId`, `active`),
    INDEX `csa_member_org_active_idx`(`organizationMembershipId`, `organizationId`, `active`),
    UNIQUE INDEX `csa_class_membership_key`(`classId`, `organizationMembershipId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `classes_id_org_key` ON `classes`(`id`, `organizationId`);

-- CreateIndex
CREATE UNIQUE INDEX `memberships_id_org_key` ON `organization_memberships`(`id`, `organizationId`);

-- AddForeignKey
ALTER TABLE `class_staff_assignments` ADD CONSTRAINT `csa_class_org_fkey` FOREIGN KEY (`classId`, `organizationId`) REFERENCES `classes`(`id`, `organizationId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_staff_assignments` ADD CONSTRAINT `csa_membership_org_fkey` FOREIGN KEY (`organizationMembershipId`, `organizationId`) REFERENCES `organization_memberships`(`id`, `organizationId`) ON DELETE CASCADE ON UPDATE CASCADE;

